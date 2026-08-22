export type MultiSelectFilterValue = string[];
export interface DateRangeFilterValue {
	from: string;
	to: string;
}
export type FilterValue = MultiSelectFilterValue | DateRangeFilterValue;
export type FilterState = Record<string, FilterValue>;

interface BaseFilterDef<T> {
	key: string;
	label: string;
}

export interface MultiSelectFilterDef<T> extends BaseFilterDef<T> {
	type: "multiSelect";
	getValue: (row: T) => string | number | null;
	/** Static option list, e.g. from a lookup table. If omitted, options are derived from distinct values in the loaded rows. */
	options?: { value: string; label: string }[];
}

export interface DateRangeFilterDef<T> extends BaseFilterDef<T> {
	type: "dateRange";
	getValue: (row: T) => string | null;
}

export type FilterDef<T> = MultiSelectFilterDef<T> | DateRangeFilterDef<T>;

export function isFilterActive<T>(
	def: FilterDef<T>,
	value: FilterValue | undefined,
): boolean {
	if (!value) return false;
	if (def.type === "multiSelect")
		return (value as MultiSelectFilterValue).length > 0;
	const range = value as DateRangeFilterValue;
	return Boolean(range.from || range.to);
}

export function emptyFilterValue<T>(def: FilterDef<T>): FilterValue {
	return def.type === "multiSelect" ? [] : { from: "", to: "" };
}

export function filterOptions<T>(
	def: MultiSelectFilterDef<T>,
	rows: T[],
): { value: string; label: string }[] {
	if (def.options) return def.options;
	const values = Array.from(
		new Set(
			rows
				.map((r) => def.getValue(r))
				.filter((v): v is string | number => v !== null && v !== undefined)
				.map(String),
		),
	).sort((a, b) => a.localeCompare(b));
	return values.map((v) => ({ value: v, label: v }));
}

export function applyFilters<T>(
	rows: T[],
	defs: FilterDef<T>[],
	state: FilterState,
): T[] {
	const activeDefs = defs.filter((d) => isFilterActive(d, state[d.key]));
	if (activeDefs.length === 0) return rows;
	return rows.filter((row) =>
		activeDefs.every((def) => {
			if (def.type === "multiSelect") {
				const value = def.getValue(row);
				const selected = state[def.key] as MultiSelectFilterValue;
				return value !== null && selected.includes(String(value));
			}
			const value = def.getValue(row);
			const range = state[def.key] as DateRangeFilterValue;
			const day = value?.slice(0, 10);
			if (range.from && (!day || day < range.from)) return false;
			if (range.to && (!day || day > range.to)) return false;
			return true;
		}),
	);
}
