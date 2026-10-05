import type { MissionMapEntry } from "@ogdb/types";

// Filters for the fleet Map page's Missions panel. Within one section
// the picks are OR'd (site A or site B); across sections they're AND'd
// (site A and glider X). An empty section means "no filter" rather than
// "match nothing", so a fresh page shows everything.
export type MissionMapFilters = {
	sites: string[];
	projects: string[];
	gliders: string[];
	// yyyy-mm-dd strings straight from <input type="date">, "" when unset.
	from: string;
	to: string;
};

export const EMPTY_MISSION_MAP_FILTERS: MissionMapFilters = {
	sites: [],
	projects: [],
	gliders: [],
	from: "",
	to: "",
};

export function hasActiveFilters(f: MissionMapFilters): boolean {
	return (
		f.sites.length > 0 ||
		f.projects.length > 0 ||
		f.gliders.length > 0 ||
		f.from !== "" ||
		f.to !== ""
	);
}

// A mission counts if its time in the water overlaps the picked range at
// all, not only if it sits entirely inside it: start <= to AND end >= from.
// A mission still in the water (no recovery or end-of-science date yet)
// is treated as running until now. One with no launch date can't be
// placed in time, so it drops out as soon as either bound is set.
function overlapsDateRange(
	m: MissionMapEntry,
	from: string,
	to: string,
): boolean {
	if (from === "" && to === "") return true;
	if (!m.launchDate) return false;

	const start = new Date(m.launchDate).getTime();
	const endValue = m.recoveryDate ?? m.endDateScience;
	const end = endValue ? new Date(endValue).getTime() : Date.now();

	// Built as local times so they line up with how formatDate() shows
	// mission dates -- a "to" date includes the whole of that day.
	if (from !== "" && end < new Date(`${from}T00:00:00`).getTime()) {
		return false;
	}
	if (to !== "" && start > new Date(`${to}T23:59:59.999`).getTime()) {
		return false;
	}
	return true;
}

function matchesPick(value: string | null, picks: string[]): boolean {
	return picks.length === 0 || (value !== null && picks.includes(value));
}

export function filterMissionMapEntries(
	missions: MissionMapEntry[],
	f: MissionMapFilters,
): MissionMapEntry[] {
	return missions.filter(
		(m) =>
			matchesPick(m.site, f.sites) &&
			matchesPick(m.project, f.projects) &&
			matchesPick(m.glider, f.gliders) &&
			overlapsDateRange(m, f.from, f.to),
	);
}

// Distinct non-null values of one field, sorted -- the chip options for
// a filter section come from the missions themselves, so a site with no
// missions never shows up as a dead option.
export function distinctValues(
	missions: MissionMapEntry[],
	key: "site" | "project" | "glider",
): string[] {
	const values = new Set<string>();
	for (const m of missions) {
		const v = m[key];
		if (v) values.add(v);
	}
	return [...values].sort((a, b) => a.localeCompare(b));
}

export function missionMapLabel(m: MissionMapEntry): string {
	const name = m.stdMissionName ?? m.missionName ?? `Mission ${m.id}`;
	return m.missionNumber != null ? `${m.missionNumber}. ${name}` : name;
}

// The track palette, chosen by the facility. Keyed off the mission id
// (not list position) so a mission keeps its colour when filters change
// what's listed around it; with ~120 missions and 10 colours, repeats
// are expected.
const TRACK_COLORS = [
	"#F5CBA0",
	"#D5B7E6",
	"#A2D8C0",
	"#FFFFFF",
	"#E8E4D6",
	"#B0E0E6",
	"#FFE4E1",
	"#FFEFD5",
	"#F7F3EA",
	"#C3CED6",
];

export function trackColor(id: number): string {
	return TRACK_COLORS[id % TRACK_COLORS.length];
}
