import type { ArgosTagConfig, ArgosTagTest } from "@ogdb/types";

// The tag's own limits from the procedure. Keep in step with the gateway's
// final-prep.service.ts, which is what actually blocks clearing.
export const TAG_BATTERY_V: readonly [number, number] = [3.3, 3.7];
export const TX_WARN = 30000;
export const TX_LIMIT = 40000;

// Everything is held as text while typing, so a half-typed number is never
// rewritten under the cursor.
export interface ArgosConfigForm {
	model: string;
	argosDec: string;
	argosHex: string;
	tagName: string;
}

export interface ArgosTestForm {
	tagwareVersion: string;
	txAttempts: string;
	txFailCount: string;
	batteryVoltage: string;
	// "" = not entered, otherwise "true" / "false".
	transmissionTestPassed: "" | "true" | "false";
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export const configFormFrom = (c: ArgosTagConfig | null): ArgosConfigForm => ({
	model: str(c?.model),
	argosDec: str(c?.argosDec),
	argosHex: str(c?.argosHex),
	tagName: str(c?.tagName),
});

export const emptyTestForm: ArgosTestForm = {
	tagwareVersion: "",
	txAttempts: "",
	txFailCount: "",
	batteryVoltage: "",
	transmissionTestPassed: "",
};

export const testFormFrom = (t: ArgosTagTest | null): ArgosTestForm =>
	t
		? {
				tagwareVersion: str(t.tagwareVersion),
				txAttempts: str(t.txAttempts),
				txFailCount: str(t.txFailCount),
				batteryVoltage: str(t.batteryVoltage),
				transmissionTestPassed:
					t.transmissionTestPassed === null
						? ""
						: t.transmissionTestPassed
							? "true"
							: "false",
			}
		: emptyTestForm;

const num = (s: string): number | null => {
	if (s.trim() === "") return null;
	const n = Number(s.replace(",", "."));
	return Number.isFinite(n) ? n : null;
};

// What the gateway receives. Hex is tidied here too (spaces out, uppercase),
// the same as the gateway does, so what is shown is what is stored.
export const configPayload = (f: ArgosConfigForm) => ({
	model: f.model.trim() || null,
	argosDec: f.argosDec.trim() || null,
	argosHex: f.argosHex.replace(/\s+/g, "").toUpperCase() || null,
	tagName: f.tagName.trim() || null,
});

export const testPayload = (f: ArgosTestForm) => ({
	tagwareVersion: f.tagwareVersion.trim() || null,
	txAttempts: num(f.txAttempts),
	txFailCount: num(f.txFailCount),
	batteryVoltage: num(f.batteryVoltage),
	transmissionTestPassed:
		f.transmissionTestPassed === ""
			? null
			: f.transmissionTestPassed === "true",
});

// Problems with what has been typed so far, to show beside the field. The
// gateway and the database check the same things again.
export function configProblems(f: ArgosConfigForm) {
	const hex = f.argosHex.replace(/\s+/g, "");
	return {
		argosDec:
			f.argosDec.trim() !== "" && !/^[0-9]{6,8}$/.test(f.argosDec.trim())
				? "6 to 8 digits."
				: null,
		argosHex:
			hex !== "" && !/^[0-9A-Fa-f]{6,7}$/.test(hex)
				? "6 or 7 hex digits (0-9, A-F)."
				: null,
	};
}

export function testProblems(f: ArgosTestForm) {
	const attempts = num(f.txAttempts);
	const fails = num(f.txFailCount);
	const volts = num(f.batteryVoltage);
	const whole = (s: string) => s.trim() === "" || /^[0-9]+$/.test(s.trim());
	return {
		txAttempts: whole(f.txAttempts) ? null : "A whole number.",
		txFailCount: !whole(f.txFailCount)
			? "A whole number."
			: attempts !== null && fails !== null && fails > attempts
				? "Can't be more than the attempts."
				: null,
		batteryVoltage:
			f.batteryVoltage.trim() !== "" &&
			(volts === null || volts < 0 || volts > 10)
				? "Volts, between 0 and 10."
				: null,
	};
}

export const volts = (f: ArgosTestForm) => num(f.batteryVoltage);
export const attempts = (f: ArgosTestForm) => num(f.txAttempts);
