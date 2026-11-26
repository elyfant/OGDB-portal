import type { ChipProps } from "@mui/material/Chip";

// THE colour strategy for chips -- one place, so a colour always means the
// same thing wherever it appears. Documented, with the full chip-by-chip list,
// in docs/design/colour-strategy.md. Change a colour HERE, not at a call site.
//
//   go       green   operating now, or a good outcome: Deployed, Active, Pass,
//                    Saved, Signed off, Closed
//   lined    blue    lined up, or away but fine: Ready to deploy, Scheduled,
//                    Transit, On loan, Field test
//   work     amber   being worked on / waiting on someone: Workshop, In-house
//                    repairs, Factory service, Open RMA, Open event, Unsaved
//   problem  red     needs action, or must not be used: Servicing required,
//                    Missing, Missing in action, Fail, High severity
//   ended    dark    finished, nothing more to do: Destroyed, Killed in action
//   inactive grey    out of play or neutral: Idle, Lab, Decommissioned
//   brand    teal    the app's own accent (selection, BETA) -- NEVER a status
//
// Filled = what something IS now (a state). Outlined = a tag or a finished
// record (Scheduled, Decommissioned, a Recovered mission). Servicing required
// is the one tag that is also filled: it has to be loud.
export type ChipRole =
	| "go"
	| "lined"
	| "work"
	| "problem"
	| "ended"
	| "inactive"
	| "brand";

export type ChipLook = Pick<ChipProps, "color" | "variant" | "sx">;

// "Ended" has no MUI palette colour: a dark slate, readable in light and dark
// mode, that is visibly not the pale grey of an idle/inactive chip.
const ENDED_SX: ChipProps["sx"] = {
	bgcolor: "#37474f",
	color: "#fff",
	"&:hover": { bgcolor: "#37474f" },
};

export const ROLE_LOOK: Record<ChipRole, ChipLook> = {
	go: { color: "success" },
	lined: { color: "info" },
	work: { color: "warning" },
	problem: { color: "error" },
	ended: { color: "default", sx: ENDED_SX },
	inactive: { color: "default" },
	brand: { color: "primary" },
};

// The same palette, for places that draw their own surface instead of a Chip
// (table row tints etc.).
export const ROLE_TINT: Record<Exclude<ChipRole, "brand">, string> = {
	go: "rgba(46, 125, 50, 0.16)",
	lined: "rgba(2, 136, 209, 0.14)",
	work: "rgba(237, 108, 2, 0.16)",
	problem: "rgba(211, 47, 47, 0.14)",
	ended: "rgba(55, 71, 79, 0.18)",
	inactive: "rgba(120, 120, 120, 0.10)",
};

// A mission's own status (the stored `status` table), as a chip.
//   active -> go, recovered -> go but OUTLINED (a finished record, not live)
const MISSION_STATUS_ROLE: Record<string, ChipRole> = {
	active: "go",
	recovered: "go",
	scheduled: "lined",
	transit: "lined",
	workshop: "work",
	"lab service": "work",
	"factory service": "work",
	"missing in action": "problem",
	"killed in action": "ended",
	discontinued: "inactive",
};

export function missionStatusChipProps(status: string | null): ChipLook {
	const role = MISSION_STATUS_ROLE[status ?? ""] ?? "inactive";
	const look = ROLE_LOOK[role];
	return status === "recovered" ? { ...look, variant: "outlined" } : look;
}
