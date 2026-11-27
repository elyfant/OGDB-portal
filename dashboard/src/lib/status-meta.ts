import type { AssetStatus } from "@ogdb/types";
import { type ChipLook, type ChipRole, ROLE_LOOK } from "./chip-style";

// Each state's chip role -- see lib/chip-style.ts for what the roles mean.
const STATUS_ROLE: Record<AssetStatus, ChipRole> = {
	deployed: "go",
	ready_to_deploy: "lined",
	transit: "lined",
	on_loan: "lined",
	field_test: "lined",
	workshop: "work",
	in_house_repairs: "work",
	factory_service: "work",
	pre_mission_service: "work",
	missing: "problem",
	destroyed: "ended",
	idle: "inactive",
	lab: "inactive",
	decommissioned: "inactive",
};

// Spread onto a <Chip> showing an asset / glider state:
// `<Chip label={STATUS_LABEL[s]} {...statusChipProps(s)} />`.
export function statusChipProps(status: AssetStatus): ChipLook {
	return ROLE_LOOK[STATUS_ROLE[status] ?? "inactive"];
}

export const STATUS_LABEL: Record<AssetStatus, string> = {
	lab: "Lab",
	in_house_repairs: "In-house repairs",
	factory_service: "Factory repairs",
	pre_mission_service: "Pre-mission service",
	transit: "Transit",
	deployed: "Deployed",
	on_loan: "On loan",
	field_test: "Field test",
	missing: "Missing",
	destroyed: "Destroyed",
	workshop: "Being prepared",
	ready_to_deploy: "Ready to deploy",
	idle: "Idle",
	decommissioned: "Decommissioned",
};

// What each glider / asset state MEANS, for the hover text on its chip. These
// are worked out from a glider's timeline, not set by hand (non-glider assets
// still set theirs manually).
export const STATUS_HINT: Record<AssetStatus, string> = {
	deployed: "On an open mission, in the water.",
	ready_to_deploy: "Its logsheet is cleared for deployment; waiting to go out.",
	workshop: "Being prepared: an open workshop build, logsheet not yet cleared.",
	in_house_repairs: "An in-house servicing job is open.",
	factory_service: "A factory repair is open (Teledyne or another repairer).",
	pre_mission_service: "A pre-mission servicing job is open.",
	transit: "In shipping or transport.",
	on_loan: "Loaned out to another institute or team.",
	field_test: "Out for a field or sea trial that isn't a logged mission.",
	missing: "Contact lost; not yet declared a total loss.",
	destroyed: "Confirmed physically destroyed.",
	idle: "Nothing else applies: not deployed, not in service, no open build.",
	lab: "In the lab.",
	decommissioned: "Retired from the fleet.",
};

// Hover text for a GLIDER's state chip: says it is the glider's state (as
// opposed to a mission's status, which can share a word with it).
export function gliderStateTitle(status: AssetStatus): string {
	return `Glider state — ${STATUS_LABEL[status]}: ${STATUS_HINT[status]} Worked out from the glider's timeline, not set by hand.`;
}
