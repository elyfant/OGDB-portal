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

// asset_types.name -> [cal table, its date column]. mr_sensor's table is
// generic (no known coefficient columns yet, see CAL_COLUMNS) -- added
// so every "sensor"-group type has one, for the Calibrations catalogue.
export const CAL_TABLES: Record<string, [table: string, dateColumn: string]> = {
	ct_sensor: ["asset_ct_sensor_cal", "cal_date"],
	do_sensor: ["asset_do_sensor_cal", "cal_date"],
	eco_sensor: ["asset_eco_sensor_cal", "cal_date"],
	mr_sensor: ["asset_mr_sensor_cal", "cal_date"],
	slocum_forward_section: ["asset_slocum_forward_section_cal", "service_date"],
};

// asset_types.name -> writable coefficient columns on its cal table --
// every real column except id/asset_id/the date column/changed_by/
// created_at. Whitelisted here rather than trusting client-submitted
// column names directly, since the write path builds a dynamic INSERT
// (see AssetsService.recordCalibration) -- column names never come
// straight from request input.
export const CAL_COLUMNS: Record<string, string[]> = {
	// sbe_temp_g/h/i/j is CT-Sail's own temperature channel naming;
	// sbe_temp_a0-a3 is GPCTD's -- genuinely different column sets, not
	// two names for the same thing (that was the mistake the original
	// a0_g_apl-style names made). sbe_cond_* is shared by both sensor
	// types, since both use the same g/h/i/j + cpcor/ctcor(/wbotc)
	// convention for conductivity.
	ct_sensor: [
		"sbe_temp_g",
		"sbe_temp_h",
		"sbe_temp_i",
		"sbe_temp_j",
		"sbe_temp_a0",
		"sbe_temp_a1",
		"sbe_temp_a2",
		"sbe_temp_a3",
		"sbe_cond_g",
		"sbe_cond_h",
		"sbe_cond_i",
		"sbe_cond_j",
		"sbe_cond_cpcor",
		"sbe_cond_ctcor",
		"sbe_cond_wbotc",
		"sbe_pres_pa0",
		"sbe_pres_pa1",
		"sbe_pres_pa2",
		"sbe_pres_ptha0",
		"sbe_pres_ptha1",
		"sbe_pres_ptha2",
		"sbe_pres_ptca0",
		"sbe_pres_ptca1",
		"sbe_pres_ptca2",
		"sbe_pres_ptcb0",
		"sbe_pres_ptcb1",
		"sbe_pres_ptcb2",
		"calibration_facility",
		"note",
		"rbr_cond_c0",
		"rbr_cond_c1",
		"rbr_cond_c2",
		"rbr_cond_x0",
		"rbr_cond_x1",
		"rbr_cond_x2",
		"rbr_cond_x3",
		"rbr_cond_x4",
		"rbr_cond_x5",
		"rbr_cond_x6",
		"rbr_temp_c0",
		"rbr_temp_c1",
		"rbr_temp_c2",
		"rbr_temp_c3",
		"rbr_pres_c0",
		"rbr_pres_c1",
		"rbr_pres_c2",
		"rbr_pres_c3",
		"rbr_pres_x0",
		"rbr_pres_x1",
		"rbr_pres_x2",
		"rbr_pres_x3",
		"rbr_pres_x4",
		"rbr_pres_x5",
	],
	do_sensor: [
		"foil_batch",
		"svufoilcoef0",
		"svufoilcoef1",
		"svufoilcoef2",
		"svufoilcoef3",
		"svufoilcoef4",
		"svufoilcoef5",
		"svufoilcoef6",
		"tempcoef0",
		"tempcoef1",
		"tempcoef2",
		"tempcoef3",
		"tempcoef4",
		"tempcoef5",
		"calibration_facility",
	],
	eco_sensor: [
		"cdom_dc",
		"cdom_sf",
		"cdom_maxoutput",
		"cdom_res",
		"cdom_cal_temp",
		"bb_wl",
		"bb_sf",
		"bb_maxoutput",
		"bb_dc",
		"bb_res_counts",
		"bb_res_sf",
		"chla_dc",
		"chla_sf",
		"chla_maxoutput",
		"chla_res",
		"chla_cal_temp",
		"turb_dc",
		"turb_ntu_sv",
		"turb_sf",
		"turb_maxoutput",
		"turb_res",
		"turb_cal_temp",
		"calibration_facility",
	],
	// No known coefficient columns yet -- no legacy mr_cal table existed
	// to migrate from, unlike ct/do/eco. Facility is the only writable
	// field until real MR calibration data shows what else belongs here.
	mr_sensor: ["calibration_facility"],
	slocum_forward_section: [
		"f_de_oil_vol_pot_voltage_min",
		"f_de_oil_vol_pot_voltage_max",
		"f_valve_restrict",
		"f_valve_open",
		"lithium_f_battpos_cal_m",
		"lithium_f_battpos_cal_b",
	],
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
