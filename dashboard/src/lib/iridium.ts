import type { IridiumGliderMonth, IridiumMissionCost } from "@ogdb/types";

// How the Iridium page turns past missions into "what will the next one
// cost?". Pure functions over the gateway's data, kept apart from the UI
// so the rules are in one readable place.

/** Average calendar month, for per-day <-> per-month conversions. */
export const AVG_MONTH_DAYS = 365.25 / 12;

/** Shorter missions are left out: pre-launch testing dominates their $/day. */
export const MIN_REFERENCE_DAYS = 14;

export const PLATFORMS = ["seaglider", "slocum"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<string, string> = {
	seaglider: "Seaglider",
	slocum: "Slocum",
	unassigned: "Unassigned",
};

/** Usage + line rental while deployed; no pre-launch / after-recovery. */
export function inMissionUsd(m: IridiumMissionCost): number {
	return m.missionUsageUsd + m.missionRentalUsd;
}

/**
 * Can this mission stand in for a future one? Recovered, at least
 * MIN_REFERENCE_DAYS long, and every month invoiced (a † mission's total is
 * too low, so it would drag the estimate down).
 */
export function isReferenceMission(m: IridiumMissionCost): boolean {
	return (
		m.fullyInvoiced &&
		m.recoveryDate !== null &&
		m.durationDays >= MIN_REFERENCE_DAYS
	);
}

/** The `count` most recently recovered reference missions of a platform (all if null). */
export function referenceMissions(
	missions: IridiumMissionCost[],
	platform: Platform,
	count: number | null,
): IridiumMissionCost[] {
	const refs = missions
		.filter((m) => m.platform === platform && isReferenceMission(m))
		.sort((a, b) => (b.recoveryDate ?? "").localeCompare(a.recoveryDate ?? ""));
	return count === null ? refs : refs.slice(0, count);
}

export function median(values: number[]): number | null {
	if (values.length === 0) return null;
	const s = [...values].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export interface Range {
	median: number;
	min: number;
	max: number;
}

function range(values: number[]): Range | null {
	const m = median(values);
	return m === null
		? null
		: { median: m, min: Math.min(...values), max: Math.max(...values) };
}

/** In-mission cost per deployed month, one value per reference mission. */
export interface Overhead {
	/** One glider's idle cost per month, USD. */
	usd: number;
	/** Gliders it's averaged over. */
	gliders: number;
	from: string; // "YYYY-MM"
	to: string;
}

/**
 * One glider's overhead: what a glider of this platform costs per month in
 * line rental and airtime that no mission is charged for, averaged over
 * every glider-month in `rows` (the last 12 invoiced months). Devices that
 * match no glider aren't any glider's cost, so they're left out.
 */
export function overheadPerGlider(
	rows: IridiumGliderMonth[],
	platform: Platform,
): Overhead | null {
	const own = rows.filter((r) => r.platform === platform);
	if (own.length === 0) return null;
	const idle = own.reduce((sum, r) => sum + (r.usd - r.missionUsd), 0);
	const months = own.map((r) => r.month).sort();
	return {
		usd: idle / own.length,
		gliders: new Set(own.map((r) => r.gliderAssetId)).size,
		from: months[0],
		to: months[months.length - 1],
	};
}

/**
 * All-in cost per deployed month for one mission: its usage + rental plus
 * its pre-launch testing, spread over its days in the water, plus one
 * glider's overhead for the month.
 */
export function perMonthUsd(
	m: IridiumMissionCost,
	overheadUsd: number,
): number {
	return (
		((inMissionUsd(m) + m.beforeLaunchUsd) / m.durationDays) * AVG_MONTH_DAYS +
		overheadUsd
	);
}

export function perDeployedMonth(
	refs: IridiumMissionCost[],
	overheadUsd: number,
): Range | null {
	return range(refs.map((m) => perMonthUsd(m, overheadUsd)));
}

export interface Estimate {
	/** Mission usage + rental for `days`, plus that mission's pre-launch testing. */
	raw: Range;
	/** Whole months the mission runs, rounded up. */
	months: number;
	overheadUsd: number;
	/** raw + one glider's overhead for `months`. */
	withOverhead: Range;
}

/**
 * "If the next mission is like one of these, what will it cost?" For each
 * reference mission: its in-mission $/day x `days`, plus its own pre-launch
 * testing. The estimate is the median of those, the range their min-max.
 */
export function estimate(
	refs: IridiumMissionCost[],
	days: number,
	overheadUsdPerMonth: number,
): Estimate | null {
	const raw = range(
		refs.map(
			(m) => (inMissionUsd(m) / m.durationDays) * days + m.beforeLaunchUsd,
		),
	);
	if (!raw || days <= 0) return null;
	const months = Math.ceil(days / AVG_MONTH_DAYS);
	const overheadUsd = overheadUsdPerMonth * months;
	return {
		raw,
		months,
		overheadUsd,
		withOverhead: {
			median: raw.median + overheadUsd,
			min: raw.min + overheadUsd,
			max: raw.max + overheadUsd,
		},
	};
}

/** "$1,235" -- whole dollars; estimates don't deserve cents. */
export function formatUsd0(value: number | null): string {
	if (value === null) return "—";
	return value.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	});
}

/** "kr 11 640" at the given USD/NOK rate. */
export function formatNok0(usd: number | null, usdNok: number | null): string {
	if (usd === null || usdNok === null) return "—";
	return `kr ${Math.round(usd * usdNok).toLocaleString("nb-NO")}`;
}

/** "2026-08" -> "Aug 2026" */
export function formatMonth(month: string): string {
	const [y, m] = month.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", {
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});
}

/** The `count` months ending at `last` ("YYYY-MM"), oldest first. */
export function monthsEndingAt(last: string, count: number): string[] {
	const [y, m] = last.split("-").map(Number);
	return Array.from({ length: count }, (_, i) => {
		const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
		return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
	});
}
