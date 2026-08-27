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

// This paste format is the Seaglider/APL-toolbox basestation convention
// specifically -- it always uses t_g/t_h/t_i/t_j (temperature) and
// c_g/c_h/c_i/c_j (conductivity), regardless of the physical CT
// sensor's own manufacturer naming. That's genuinely CT-Sail-shaped
// (GPCTD's own certs use a0/a1/a2/a3 for temperature instead, entered
// through the Calibrations catalogue's manual form, never through this
// paste path) -- confirmed against real coefficient magnitudes already
// in asset_ct_sensor_cal (temperature ~1e-3..1e-7, conductivity G/H/I/J
// cluster around G=-10, H=1.x). Every real column this format can
// produce gets an explicit entry here -- nothing is assumed to match a
// column name literally, since every one of them now carries an
// sbe_<channel>_ prefix that no pasted variable name has on its own.
const CT_CAL_REMAP: Record<string, string> = {
	t_g: "sbe_temp_g",
	t_h: "sbe_temp_h",
	t_i: "sbe_temp_i",
	t_j: "sbe_temp_j",
	c_g: "sbe_cond_g",
	c_h: "sbe_cond_h",
	c_i: "sbe_cond_i",
	c_j: "sbe_cond_j",
	cpcor: "sbe_cond_cpcor",
	ctcor: "sbe_cond_ctcor",
	wbotc: "sbe_cond_wbotc",
	pa0: "sbe_pres_pa0",
	pa1: "sbe_pres_pa1",
	pa2: "sbe_pres_pa2",
	ptha0: "sbe_pres_ptha0",
	ptha1: "sbe_pres_ptha1",
	ptha2: "sbe_pres_ptha2",
	ptca0: "sbe_pres_ptca0",
	ptca1: "sbe_pres_ptca1",
	ptca2: "sbe_pres_ptca2",
	ptcb0: "sbe_pres_ptcb0",
	ptcb1: "sbe_pres_ptcb1",
	ptcb2: "sbe_pres_ptcb2",
};

export function mapCtCalFields(fields: ParsedCalField[]): MappedCalFields {
	const coefficients: Record<string, number | string> = {};
	const unmapped: ParsedCalField[] = [];

	for (const field of fields) {
		const column = CT_CAL_REMAP[field.name];
		if (!column) {
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
