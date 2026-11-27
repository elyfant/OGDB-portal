import { type ChipLook, type ChipRole, ROLE_LOOK } from "./chip-style";

// A MISSION's two tags (lib/chip-style.ts has the colour roles):
//
//   1. LIFECYCLE -- where the mission is in its life: Workshop -> Scheduled ->
//      Active -> Ended. Always shown.
//   2. CAUSE OF ENDING -- only once it has Ended: why. Chosen when editing the
//      mission ("Cause of mission end"). "Voluntary recovery of the platform" is
//      shown as "Normal" to keep it short.
//
// The STORED status (the `status` table) is unchanged: recovered, killed in
// action, missing in action and discontinued are all just "Ended" here, and the
// cause says how. Only the labels differ -- no migration.
export type Lifecycle = "workshop" | "scheduled" | "active" | "ended";

export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
	workshop: "Workshop",
	scheduled: "Scheduled",
	active: "Active",
	ended: "Ended",
};

const LIFECYCLE_HINT: Record<Lifecycle, string> = {
	workshop: "The glider is being prepared; no mission is assigned yet.",
	scheduled: "A mission is assigned to the glider; not deployed yet.",
	active: "In the water: the mission is under way.",
	ended: "Finished. The cause of ending is shown separately.",
};

// Stored statuses that mean the mission is over.
const ENDED_STATUSES = new Set([
	"recovered",
	"killed in action",
	"missing in action",
	"discontinued",
]);

// Old statuses that describe the GLIDER, not a mission's stage (factory
// service, lab service, transit). Nothing uses them any more, and a glider's
// own state already says it, so they are hidden from the status dropdown and
// filters. The rows stay in the table.
export const RETIRED_MISSION_STATUSES = new Set([
	"factory service",
	"lab service",
	"transit",
]);

export function missionLifecycle(status: string | null): Lifecycle | null {
	if (!status) return null;
	if (status === "workshop" || status === "scheduled" || status === "active")
		return status;
	if (ENDED_STATUSES.has(status)) return "ended";
	return null;
}

// Lifecycle chip: amber workshop, blue scheduled, green active, and an outlined
// grey "Ended" (a finished record -- the cause chip carries the colour).
const LIFECYCLE_ROLE: Record<Lifecycle, ChipRole> = {
	workshop: "work",
	scheduled: "lined",
	active: "go",
	ended: "inactive",
};

export function lifecycleChipProps(lifecycle: Lifecycle): ChipLook {
	const look = ROLE_LOOK[LIFECYCLE_ROLE[lifecycle]];
	return lifecycle === "ended" ? { ...look, variant: "outlined" } : look;
}

export function lifecycleTitle(lifecycle: Lifecycle): string {
	return `Mission lifecycle — ${LIFECYCLE_LABEL[lifecycle]}: ${LIFECYCLE_HINT[lifecycle]} This is the mission's own stage, separate from the glider's state.`;
}

// What a status reads as in a dropdown: a mission that ended in some way is
// "Ended", with the old outcome kept in brackets so the choice is still clear.
export function missionStatusOptionLabel(status: string): string {
	const lifecycle = missionLifecycle(status);
	if (lifecycle !== "ended") {
		return status.charAt(0).toUpperCase() + status.slice(1);
	}
	return status === "recovered" ? "Ended" : `Ended — ${status}`;
}

// "Voluntary recovery of the platform" is the normal way a mission ends.
export function shortEndingCause(cause: string): string {
	return /voluntary recovery/i.test(cause) ? "Normal" : cause;
}

// How each cause reads: green = normal, red = the glider was lost or damaged,
// amber = a technical fault, grey = administrative or unknown.
const CAUSE_ROLE: Record<string, ChipRole> = {
	"voluntary recovery of the platform": "go",
	"hit by ship": "problem",
	vandalized: "problem",
	"platform damaged by a leak": "problem",
	"beached platform": "problem",
	"groundings at the seafloor": "problem",
	"platform permanently under sea ice": "problem",
	"anchor broken/adrift": "problem",
	"altimeter issue": "work",
	"ballast issues": "work",
	"battery exhausted": "work",
	"battery failure": "work",
	"bluetooth problem": "work",
	"defect of the primary ctd sensor": "work",
	"electrical issues": "work",
	"hydraulic issues": "work",
	"internal vacuum issues": "work",
	"misc. hardware issues": "work",
	"positioning issues": "work",
	"software issues": "work",
	"telemetry issues": "work",
	"bad data": "work",
	"deployment issues": "work",
};

export interface EndingCauseChip {
	label: string;
	look: ChipLook;
	title: string;
}

// The second tag, for a mission that has ended; null otherwise (and null for an
// ended mission whose cause was never recorded). A mission stored as "killed in
// action" / "missing in action" keeps its outcome colour (slate / red) even
// when a cause is chosen, and with no cause it falls back to saying so.
export function endingCauseChip(m: {
	status: string | null;
	endingCause: string | null;
}): EndingCauseChip | null {
	if (missionLifecycle(m.status) !== "ended") return null;
	const outcomeRole: ChipRole | null =
		m.status === "killed in action"
			? "ended"
			: m.status === "missing in action"
				? "problem"
				: null;

	if (m.endingCause) {
		const role =
			outcomeRole ?? CAUSE_ROLE[m.endingCause.toLowerCase()] ?? "inactive";
		return {
			label: shortEndingCause(m.endingCause),
			look: ROLE_LOOK[role],
			title: `Cause for mission end — ${m.endingCause}. Chosen when editing the mission.`,
		};
	}
	if (outcomeRole) {
		const label =
			m.status === "killed in action"
				? "Killed in action"
				: "Missing in action";
		return {
			label,
			look: ROLE_LOOK[outcomeRole],
			title: `Cause for mission end — ${label}. No more specific cause has been chosen yet.`,
		};
	}
	return null;
}
