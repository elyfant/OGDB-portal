import { BadRequestException } from "@nestjs/common";

// Validation of values submitted from the logsheet forms. "" and null both
// mean "not entered". Shared by every refurbishment section.

export type Kind = "date" | "bool" | "int" | "num" | "text";

export const MAX_TEXT = 4000;

export function isBlank(v: unknown): boolean {
	return v === null || v === undefined || v === "";
}

// Validates one submitted value against its kind. "" and null both mean
// "not entered".
export function coerce(key: string, kind: Kind, v: unknown): unknown {
	if (isBlank(v)) return null;
	const bad = (what: string) =>
		new BadRequestException(`${key}: expected ${what}.`);
	switch (kind) {
		case "bool":
			if (typeof v !== "boolean") throw bad("true or false");
			return v;
		case "int": {
			const n = typeof v === "string" ? Number(v) : v;
			if (typeof n !== "number" || !Number.isInteger(n))
				throw bad("a whole number");
			return n;
		}
		case "num": {
			const n = typeof v === "string" ? Number(v) : v;
			if (typeof n !== "number" || !Number.isFinite(n)) throw bad("a number");
			return n;
		}
		case "date":
			if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
				throw bad("a date (YYYY-MM-DD)");
			}
			return v;
		case "text":
			if (typeof v !== "string") throw bad("text");
			if (v.length > MAX_TEXT) throw bad(`at most ${MAX_TEXT} characters`);
			return v;
	}
}
