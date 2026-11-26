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
	factory_service: "Factory service",
	pre_mission_service: "Pre-mission service",
	transit: "Transit",
	deployed: "Deployed",
	on_loan: "On loan",
	field_test: "Field test",
	missing: "Missing",
	destroyed: "Destroyed",
	workshop: "Workshop",
	ready_to_deploy: "Ready to deploy",
	idle: "Idle",
	decommissioned: "Decommissioned",
};
