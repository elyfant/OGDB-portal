import type { TankRun, TankRunValues } from "@ogdb/types";

// One field of the tank-run form. The same table renders the form and turns
// it back into the API payload, so a field is added in one place (plus the
// gateway's FIELDS table and the migration).
export type FieldKind = "date" | "bool" | "int" | "num" | "text";
export interface FieldDef {
	key: keyof TankRunValues;
	label: string;
	kind: FieldKind;
	unit?: string;
	help?: string;
}
export interface SectionDef {
	title: string;
	hint?: string;
	fields: FieldDef[];
}

export const SECTIONS: SectionDef[] = [
	{
		title: "Set-up",
		fields: [
			{ key: "runDate", label: "Date", kind: "date" },
			{
				key: "argosMounted",
				label: "Argos tag mounted on the antenna?",
				kind: "bool",
				help: "If not, use a dummy lead weight. The tag is about 50 g negative in water.",
			},
			{
				key: "weightAirKg",
				label: "Total weight in air",
				kind: "num",
				unit: "kg",
				help: "Assembled as it will be deployed: wings, screws, Argos tag.",
			},
		],
	},
	{
		title: "Initial readings",
		hint: "In the tank, centred, VBD adjusted so the glider is just submerged.",
		fields: [
			{ key: "pitchAd", label: "Pitch", kind: "int", unit: "AD" },
			{ key: "pitchCm", label: "Pitch", kind: "num", unit: "cm" },
			{ key: "rollAd", label: "Roll", kind: "int", unit: "AD" },
			{ key: "rollDeg", label: "Roll", kind: "num", unit: "deg" },
			{ key: "vbdAd", label: "VBD", kind: "int", unit: "AD" },
			{ key: "vbdCc", label: "VBD", kind: "num", unit: "cc" },
			{
				key: "internalRh",
				label: "Internal humidity",
				kind: "num",
				unit: "% RH",
			},
			{
				key: "internalTempC",
				label: "Internal temperature",
				kind: "num",
				unit: "°C",
			},
			{
				key: "internalPressurePsia",
				label: "Internal pressure",
				kind: "num",
				unit: "psia",
			},
		],
	},
	{
		title: "Roll check",
		fields: [
			{
				key: "rollAngleDeg",
				label: "Roll angle at 2048 AD",
				kind: "num",
				unit: "deg",
				help: "Should be 0° ± 5°.",
			},
			{ key: "rollOk", label: "Roll OK?", kind: "bool" },
			{
				key: "rollAdjustment",
				label: "Adjustment made",
				kind: "text",
				help: "Describe any change to the external ballast.",
			},
		],
	},
	{
		title: "Pitch check",
		fields: [
			{
				key: "pitchAngleDeg",
				label: "Pitch angle at the pitch centre",
				kind: "num",
				unit: "deg",
				help: "Should be 0° within 2700 ± 200 AD.",
			},
			{ key: "pitchOk", label: "Pitch OK?", kind: "bool" },
			{ key: "pitchAdjustment", label: "Adjustment made", kind: "text" },
		],
	},
	{
		title: "Tank water",
		fields: [
			{ key: "tankTempC", label: "Tank temperature", kind: "num", unit: "°C" },
			{
				key: "tankSalinityPsu",
				label: "Tank salinity",
				kind: "num",
				unit: "PSU",
			},
			{
				key: "tankDensityKgm3",
				label: "Tank density",
				kind: "num",
				unit: "kg/m³",
				help: "About 1000–1030 kg/m³ (not g/cc).",
			},
			{ key: "ctOk", label: "CT readings OK?", kind: "bool" },
		],
	},
	{
		title: "Ballast",
		fields: [
			{
				key: "targetMaxDensityKgm3",
				label: "Target max density",
				kind: "num",
				unit: "kg/m³",
			},
			{
				key: "desiredTankWeightG",
				label: "Desired tank weight",
				kind: "num",
				unit: "g",
				help: "From naco/seaglider/ballast/SgBallast.m.",
			},
			{
				key: "measuredTankWeightG",
				label: "Measured tank weight",
				kind: "num",
				unit: "g",
				help: "VBD at max negative buoyancy, all oil inside.",
			},
			{
				key: "ballastChanges",
				label: "Ballast changes",
				kind: "text",
				help: "What was added or removed, and how much.",
			},
		],
	},
	{
		title: "Final trim values",
		hint: "Saved with this refurbishment when the final run is signed off.",
		fields: [
			{
				key: "trimMassKg",
				label: "$MASS (total weight in air)",
				kind: "num",
				unit: "kg",
			},
			{ key: "trimCVbdAd", label: "VBD centre", kind: "int", unit: "AD" },
			{ key: "trimCPitchAd", label: "Pitch centre", kind: "int", unit: "AD" },
			{ key: "trimCRollAd", label: "Roll centre", kind: "int", unit: "AD" },
		],
	},
	{
		title: "Notes",
		fields: [{ key: "notes", label: "Notes", kind: "text" }],
	},
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);

export interface PitchPointForm {
	pitchCm: string;
	pitchDeg: string;
}
export interface CtReadingForm {
	sensorLabel: string;
	tempC: string;
	salinityPsu: string;
}
// Everything is held as text while editing ("" = not entered, booleans as
// "true" / "false"), so a half-typed number never gets rewritten under the
// cursor.
export interface TankRunForm {
	isFinal: boolean;
	fields: Record<string, string>;
	pitchPoints: PitchPointForm[];
	ctReadings: CtReadingForm[];
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function formFromRun(run: TankRun): TankRunForm {
	const fields: Record<string, string> = {};
	for (const f of ALL_FIELDS) fields[f.key] = str(run[f.key]);
	return {
		isFinal: run.isFinal,
		fields,
		pitchPoints: run.pitchPoints.map((p) => ({
			pitchCm: str(p.pitchCm),
			pitchDeg: str(p.pitchDeg),
		})),
		ctReadings: run.ctReadings.map((c) => ({
			sensorLabel: c.sensorLabel,
			tempC: str(c.tempC),
			salinityPsu: str(c.salinityPsu),
		})),
	};
}

function toValue(kind: FieldKind, raw: string): unknown {
	if (raw === "") return null;
	if (kind === "bool") return raw === "true";
	if (kind === "int" || kind === "num") return Number(raw.replace(",", "."));
	return raw;
}

export function payloadFromForm(form: TankRunForm): Record<string, unknown> {
	const out: Record<string, unknown> = { isFinal: form.isFinal };
	for (const f of ALL_FIELDS) out[f.key] = toValue(f.kind, form.fields[f.key]);
	out.pitchPoints = form.pitchPoints.map((p) => ({
		pitchCm: toValue("num", p.pitchCm),
		pitchDeg: toValue("num", p.pitchDeg),
	}));
	out.ctReadings = form.ctReadings.map((c) => ({
		sensorLabel: c.sensorLabel,
		tempC: toValue("num", c.tempC),
		salinityPsu: toValue("num", c.salinityPsu),
	}));
	return out;
}

const num = (s: string): number | null => {
	if (s === "") return null;
	const n = Number(s.replace(",", "."));
	return Number.isFinite(n) ? n : null;
};

// Pitch gain = change in pitch angle per cm of battery movement. Between
// each pair of neighbouring points, and overall from first to last. Typical
// values are 25–30 deg/cm; 20–50 is acceptable.
export interface PitchGain {
	pairs: { from: number; to: number; gain: number }[];
	overall: number | null;
}
export function pitchGain(points: PitchPointForm[]): PitchGain {
	const pts = points
		.map((p) => ({ cm: num(p.pitchCm), deg: num(p.pitchDeg) }))
		.filter(
			(p): p is { cm: number; deg: number } => p.cm !== null && p.deg !== null,
		);
	const gainOf = (a: (typeof pts)[number], b: (typeof pts)[number]) =>
		b.cm === a.cm ? null : (b.deg - a.deg) / (b.cm - a.cm);
	const pairs: PitchGain["pairs"] = [];
	for (let i = 1; i < pts.length; i++) {
		const g = gainOf(pts[i - 1], pts[i]);
		if (g !== null) pairs.push({ from: i, to: i + 1, gain: g });
	}
	const overall = pts.length >= 2 ? gainOf(pts[0], pts[pts.length - 1]) : null;
	return { pairs, overall };
}

export const PITCH_GAIN_TYPICAL: [number, number] = [25, 30];
export const PITCH_GAIN_ACCEPTABLE: [number, number] = [20, 50];
export const TANK_WEIGHT_TOLERANCE_G = 15;

export function tankWeightDifference(form: TankRunForm): number | null {
	const desired = num(form.fields.desiredTankWeightG);
	const measured = num(form.fields.measuredTankWeightG);
	return desired === null || measured === null ? null : measured - desired;
}

// volmax [cc] = mass [kg] / tank density [kg/m³] × 10⁶ [cc/m³].
export function volmaxCc(form: TankRunForm): number | null {
	const mass = num(form.fields.trimMassKg) ?? num(form.fields.weightAirKg);
	const rho = num(form.fields.tankDensityKgm3);
	return mass === null || rho === null || rho === 0 ? null : (mass / rho) * 1e6;
}
