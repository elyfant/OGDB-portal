import type { ReactNode } from "react";

// MUI's small-size Select, Chip, and Button don't share a common height by
// default (40px vs 24px vs ~31px) — pin every toolbar control to this so a
// row of mixed controls (column picker, filter chips, buttons) lines up.
export const TOOLBAR_CONTROL_HEIGHT = 40;

export type ColumnKind = "string" | "number" | "date" | "boolean";

export interface ColumnDef<T> {
	key: Extract<keyof T, string>;
	label: string;
	kind: ColumnKind;
	defaultVisible: boolean;
	align?: "right" | "center";
	/** Capitalize the first letter for display — only for known lowercase single-word/phrase fields, not slugs. */
	capitalize?: boolean;
	format?: (value: unknown) => string;
	/** Overrides the cell's on-screen display (e.g. an inline status editor, an icon) — sort/filter/CSV export still use the raw column value. */
	renderCell?: (row: T) => ReactNode;
}

export function defaultVisibleColumns<T>(
	columns: ColumnDef<T>[],
): ColumnDef<T>["key"][] {
	return columns.filter((c) => c.defaultVisible).map((c) => c.key);
}

export function formatColumnValue<T>(
	value: unknown,
	column: ColumnDef<T>,
): string {
	if (column.format) return column.format(value);
	if (value === null || value === undefined || value === "") return "—";
	if (column.kind === "date") {
		return new Date(value as string).toLocaleDateString("en-GB", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}
	if (column.kind === "number") {
		return (value as number).toLocaleString("en-GB", {
			maximumFractionDigits: 2,
		});
	}
	if (column.kind === "boolean") return value ? "Yes" : "No";
	if (typeof value === "string") {
		return column.capitalize
			? value.charAt(0).toUpperCase() + value.slice(1)
			: value;
	}
	return String(value);
}

// Raw-ish values for CSV: no thousands separators (so Excel/Sheets treat
// numbers as numbers) and no "—" placeholder (an empty cell sums/sorts
// cleanly; a literal em-dash doesn't).
export function toCsvCell<T>(value: unknown, column: ColumnDef<T>): string {
	if (value === null || value === undefined || value === "") return "";
	if (column.kind === "date") return String(value).slice(0, 10);
	if (column.kind === "number") return String(value);
	if (column.kind === "boolean") return value ? "true" : "false";
	if (typeof value === "string") {
		return column.capitalize
			? value.charAt(0).toUpperCase() + value.slice(1)
			: value;
	}
	return String(value);
}

function escapeCsvField(field: string): string {
	return /[",\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

export function rowsToCsv<T>(rows: T[], columns: ColumnDef<T>[]): string {
	const header = columns.map((c) => escapeCsvField(c.label));
	const lines = rows.map((row) =>
		columns.map((c) => escapeCsvField(toCsvCell(row[c.key], c))),
	);
	return [header, ...lines].map((line) => line.join(",")).join("\r\n");
}

export function downloadCsv(fileNameBase: string, csv: string) {
	const date = new Date().toISOString().slice(0, 10);
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `${fileNameBase}-${date}.csv`;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

export function compareColumnValues(
	a: unknown,
	b: unknown,
	kind: ColumnKind,
	direction: "asc" | "desc",
): number {
	if (a === null || a === undefined)
		return b === null || b === undefined ? 0 : 1;
	if (b === null || b === undefined) return -1;

	let cmp: number;
	if (kind === "number") {
		cmp = (a as number) - (b as number);
	} else if (kind === "date") {
		cmp = new Date(a as string).getTime() - new Date(b as string).getTime();
	} else if (kind === "boolean") {
		cmp = (a ? 1 : 0) - (b ? 1 : 0);
	} else {
		cmp = String(a).localeCompare(String(b));
	}
	return direction === "asc" ? cmp : -cmp;
}
