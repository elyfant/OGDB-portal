// asset_types.name -> classification data shared across modules (glider
// build, asset search, build-change validation). Single source of truth
// so gliders/build.helpers.ts and assets/assets.service.ts don't drift —
// mirrors OGDB's scripts/build_glider_assignments.py DETAIL_TABLES/
// ASSEMBLY_NUMBER_LOOKUP, which has its own copy on the Python side.

// asset_types.name -> detail table name. Types with no distinguishing
// attributes beyond the generic assets columns have no entry here
// (argos_tag, nose_cone, ...pending rename to slocum_recovery_nose).
export const DETAIL_TABLES: Record<string, string> = {
	glider: "asset_glider_details",
	slocum_aft_section: "asset_slocum_aft_section_details",
	slocum_forward_section: "asset_slocum_forward_section_details",
	slocum_end_cap: "asset_slocum_end_cap_details",
	slocum_payload_bay: "asset_slocum_payload_bay_details",
	slocum_hull: "asset_slocum_hull_details",
	slocum_altimeter: "asset_slocum_altimeter_details",
	slocum_energy_bay: "asset_slocum_energy_bay_details",
	slocum_thruster: "asset_slocum_thruster_details",
	battery: "asset_battery_details",
	ct_sensor: "asset_sensor_details",
	do_sensor: "asset_sensor_details",
	eco_sensor: "asset_sensor_details",
	mr_sensor: "asset_sensor_details",
};

// Types whose detail table has a plain `model` text column, no NVS/
// battery_models/hull_models indirection needed. Every one of these is
// also in DETAIL_TABLES; this is the subset with the simple case.
export const FLAT_MODEL_TABLES: Record<string, string> = {
	slocum_aft_section: "asset_slocum_aft_section_details",
	slocum_forward_section: "asset_slocum_forward_section_details",
	slocum_end_cap: "asset_slocum_end_cap_details",
	slocum_payload_bay: "asset_slocum_payload_bay_details",
	slocum_altimeter: "asset_slocum_altimeter_details",
	slocum_energy_bay: "asset_slocum_energy_bay_details",
	slocum_thruster: "asset_slocum_thruster_details",
};

// asset_types.name -> [cal table, its date column]. Only these four types
// have a dedicated calibration history table.
export const CAL_TABLES: Record<string, [table: string, dateColumn: string]> = {
	ct_sensor: ["asset_ct_sensor_cal", "cal_date"],
	do_sensor: ["asset_do_sensor_cal", "cal_date"],
	eco_sensor: ["asset_eco_sensor_cal", "cal_date"],
	slocum_forward_section: ["asset_slocum_forward_section_cal", "service_date"],
};

// asset_types.name -> the asset_types.name value(s) a parent must have for
// that type to be a valid child. From docs/design/build-hierarchy.md
// "Valid parent(s) by asset type" -- worked out against the real 16-type
// list. Enforced at the gateway layer for the build-change write path;
// not yet a DB-level constraint (see build-hierarchy.md's write-path
// validation gap).
export const VALID_PARENT_TYPES: Record<string, string[]> = {
	nose_cone: ["glider"],
	slocum_aft_section: ["glider"],
	slocum_altimeter: ["glider"],
	slocum_energy_bay: ["glider"],
	slocum_forward_section: ["glider"],
	slocum_hull: ["glider"],
	slocum_payload_bay: ["glider"],
	slocum_thruster: ["glider"],
	do_sensor: ["glider"],
	mr_sensor: ["glider"],
	battery: ["glider"],
	argos_tag: ["glider"],
	ct_sensor: ["glider", "slocum_payload_bay"],
	eco_sensor: ["glider", "slocum_payload_bay"],
	slocum_end_cap: ["slocum_aft_section"],
};
