import type { ArgosTagTest } from "@ogdb/types";

// The tag's own limits from the procedure. Keep in step with the gateway's
// final-prep.service.ts, which is what actually blocks clearing.
export const TAG_BATTERY_V: readonly [number, number] = [3.3, 3.7];
export const TX_WARN = 30000;
export const TX_LIMIT = 40000;

// Everything is held as text while typing, so a half-typed number is never
// rewritten under the cursor.
export interface ArgosTestForm {
	tagwareVersion: string;
	txAttempts: string;
	txFailCount: string;
	batteryVoltage: string;
	// "" = not entered, otherwise "true" / "false".
	transmissionTestPassed: "" | "true" | "false";
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

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
