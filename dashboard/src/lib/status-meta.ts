import type { AssetStatus } from "@ogdb/types";

export const STATUS_COLOR: Record<
	AssetStatus,
	"default" | "success" | "warning" | "error" | "info"
> = {
	lab: "default",
	in_house_repairs: "warning",
	factory_service: "warning",
	transit: "info",
	deployed: "success",
	on_loan: "info",
	field_test: "info",
	missing: "error",
	destroyed: "error",
	decommissioned: "default",
};

export const STATUS_LABEL: Record<AssetStatus, string> = {
	lab: "Lab",
	in_house_repairs: "In-house repairs",
	factory_service: "Factory service",
	transit: "Transit",
	deployed: "Deployed",
	on_loan: "On loan",
	field_test: "Field test",
	missing: "Missing",
	destroyed: "Destroyed",
	decommissioned: "Decommissioned",
};
