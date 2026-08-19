// Parses a pasted MATLAB-style calibration-constants block (the format
// SBE/Seaglider `sg_calib_constants.m`-style files always use:
// `name=value;% comment`) into raw name/value pairs, then maps those
// names onto the real asset_ct_sensor_cal column names.
//
// Two-step on purpose: parsing "what variables and values are in this
// text" is generic to the whole format; mapping "which DB column does
// t_g mean" is specific to one asset type's cal table. Keeping them
// separate means a do_sensor/eco_sensor mapping later reuses the same
// parser, just with its own field map.

export interface ParsedCalField {
	name: string;
	rawValue: string;
}

// Splits comment from code without being fooled by a `%` inside a quoted
// string (calibcomm's value could in principle contain one).
function stripComment(line: string): string {
	let inQuote: string | null = null;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (inQuote) {
			if (ch === inQuote) inQuote = null;
		} else if (ch === "'" || ch === '"') {
			inQuote = ch;
		} else if (ch === "%") {
			return line.slice(0, i);
		}
	}
	return line;
}

const ASSIGNMENT_RE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+?)\s*;?\s*$/;

export function parseCalText(text: string): ParsedCalField[] {
	const fields: ParsedCalField[] = [];
	for (const rawLine of text.split("\n")) {
		const line = stripComment(rawLine).trim();
		if (!line) continue;
		const match = line.match(ASSIGNMENT_RE);
		if (!match) continue;
		fields.push({ name: match[1], rawValue: match[2].trim() });
	}
	return fields;
}

// A quoted MATLAB string ('...' or "...") -> its contents; everything
// else is treated as a number.
function coerceValue(rawValue: string): {
	value: number | string;
	isNumber: boolean;
} {
	if (
		(rawValue.startsWith("'") && rawValue.endsWith("'")) ||
		(rawValue.startsWith('"') && rawValue.endsWith('"'))
	) {
		return { value: rawValue.slice(1, -1), isNumber: false };
	}
	const num = Number(rawValue);
	if (!Number.isNaN(num) && rawValue !== "") {
		return { value: num, isNumber: true };
	}
	return { value: rawValue, isNumber: false };
}

export interface MappedCalFields {
	// Ready to submit as RecordSensorCalibrationInput.coefficients --
	// keys are real asset_ct_sensor_cal column names.
	coefficients: Record<string, number | string>;
	// Parsed variable names with no known column -- shown so nothing
	// silently gets dropped (matches "some fields won't map" reality of
	// this table covering several CT sensor conventions at once).
	unmapped: ParsedCalField[];
}

// CT-sail/APL-toolbox naming remap -- confirmed against real coefficient
// magnitudes already in asset_ct_sensor_cal (temperature-channel values
// are ~1e-3..1e-7, conductivity G/H/I/J cluster around G=-10, H=1.x):
// the a0_g_apl family is the temperature channel, bare g/h/i/j is
// conductivity.
const CT_CAL_REMAP: Record<string, string> = {
	t_g: "a0_g_apl",
	t_h: "a1_h_apl",
	t_i: "a2_i_apl",
	t_j: "a3_j_apl",
	c_g: "g",
	c_h: "h",
	c_i: "i",
	c_j: "j",
};

// Real asset_ct_sensor_cal columns that already match a pasted SBE
// variable name literally -- covers the rest of the catch-all schema
// (wbotc, pressure terms, RBR-style fields) without needing a remap
// entry for each one.
const CT_CAL_DIRECT_COLUMNS = new Set([
	"cpcor",
	"ctcor",
	"wbotc",
	"pa0",
	"pa1",
	"pa2",
	"ptha0",
	"ptha1",
	"ptha2",
	"ptca0",
	"ptca1",
	"ptca2",
	"ptcb0",
	"ptcb1",
	"ptcb2",
	"calibcomm",
	"sbe_cond_freq_min",
	"sbe_cond_freq_max",
	"sbe_temp_freq_min",
	"sbe_temp_freq_max",
]);

const CT_CAL_UNMAP: Record<string, string> = Object.fromEntries(
	Object.entries(CT_CAL_REMAP).map(([varName, column]) => [column, varName]),
);

// Layout mirrors a typical sg_calib_constants.m: comment, temperature
// channel, conductivity channel, then cpcor/ctcor and frequency ranges.
const CT_CAL_M_FIELD_ORDER = [
	"calibcomm",
	"a0_g_apl",
	"a1_h_apl",
	"a2_i_apl",
	"a3_j_apl",
	"g",
	"h",
	"i",
	"j",
	"cpcor",
	"ctcor",
	"sbe_cond_freq_min",
	"sbe_cond_freq_max",
	"sbe_temp_freq_min",
	"sbe_temp_freq_max",
];

function formatMatlabNumber(value: number): string {
	if (value === 0) return "0.00000000E+00";
	const [mantissa, rawExp] = value.toExponential(8).split("e");
	const expNum = Number(rawExp);
	const sign = expNum >= 0 ? "+" : "-";
	const expStr = String(Math.abs(expNum)).padStart(2, "0");
	return `${mantissa}E${sign}${expStr}`;
}

// Reconstructs the sg_calib_constants.m text for a CT sensor's
// calibration record -- the inverse of mapCtCalFields, so pasting the
// output back in would round-trip to the same column values. Not a copy
// of any original file (there isn't one on file) -- generated fresh
// from whatever's in asset_ct_sensor_cal, so it can never go stale.
export function renderSgCalibConstants(
	coefficients: Record<string, number | string | null>,
): string {
	const lines: string[] = ["% CT sensors cal constants"];
	for (const column of CT_CAL_M_FIELD_ORDER) {
		const value = coefficients[column];
		if (value === null || value === undefined) continue;
		const varName = CT_CAL_UNMAP[column] ?? column;
		lines.push(
			typeof value === "string"
				? `${varName}='${value}';`
				: `${varName}=${formatMatlabNumber(value)};`,
		);
	}
	return lines.join("\n");
}

export function mapCtCalFields(fields: ParsedCalField[]): MappedCalFields {
	const coefficients: Record<string, number | string> = {};
	const unmapped: ParsedCalField[] = [];

	for (const field of fields) {
		const column = CT_CAL_REMAP[field.name] ?? field.name;
		if (
			!(field.name in CT_CAL_REMAP) &&
			!CT_CAL_DIRECT_COLUMNS.has(field.name)
		) {
			unmapped.push(field);
			continue;
		}
		const { value } = coerceValue(field.rawValue);
		coefficients[column] = value;
	}

	return { coefficients, unmapped };
}

// One entry per asset type with a known paste format -- extend this as
// do_sensor/eco_sensor formats get confirmed. The "Paste calibration"
// action only shows for asset types present here.
export const CAL_PASTE_MAPPERS: Record<
	string,
	(fields: ParsedCalField[]) => MappedCalFields
> = {
	ct_sensor: mapCtCalFields,
};
