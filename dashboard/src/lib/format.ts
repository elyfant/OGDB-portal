import type { ChipProps } from "@mui/material/Chip";

export function statusColor(status: string | null): ChipProps["color"] {
	if (status === "active" || status === "recovered") return "success";
	if (status === "scheduled") return "warning";
	if (status === "killed in action" || status === "missing in action")
		return "error";
	return "default";
}

export function formatDate(value: string | null): string {
	if (!value) return "—";
	return new Date(value).toLocaleDateString("en-GB", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

const ACRONYM_WORDS = new Set(["ct", "do", "mr"]);

export function formatAssetType(assetType: string): string {
	const words = assetType.replace(/^slocum_/, "").split("_");
	return words
		.map((w) =>
			ACRONYM_WORDS.has(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1),
		)
		.join(" ");
}

// Humanizes a raw DB column name (snake_case) for display in a generic
// field/value table, e.g. "aft_section_assy" -> "Aft section assy".
export function formatFieldName(field: string): string {
	const words = field.split("_");
	const first = words[0][0].toUpperCase() + words[0].slice(1);
	return [first, ...words.slice(1)].join(" ");
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

// Generic value renderer for a detail/cal table's field, whose type
// isn't known statically (the whole point of showing "every field" is
// not needing a typed shape per asset type). Dates come back from the
// gateway as ISO strings (or ISO-prefixed timestamps) after JSON
// serialization -- reformat those, render everything else as-is.
export function formatFieldValue(
	value: string | number | boolean | null,
): string {
	if (value === null) return "—";
	if (typeof value === "string" && ISO_DATE_RE.test(value))
		return formatDate(value);
	return String(value);
}

export function formatDateTime(value: string | null): string {
	if (!value) return "—";
	return new Date(value).toLocaleString("en-GB", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function formatUsd(value: number | null): string {
	if (value === null) return "—";
	return value.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
	});
}
