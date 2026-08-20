// Mirrors gateway/src/common/asset-tables.ts's CAL_COLUMNS, minus
// calibration_facility (the Add-calibration dialog gives that its own
// field). Duplicated because gateway and dashboard don't share a runtime
// module -- only @ogdb/types is shared between them. Keep in sync by
// hand, same convention already accepted for SLOCUM_ONLY_CHILD_TYPES
// elsewhere in this project.
export const CAL_FIELDS: Record<string, string[]> = {
	ct_sensor: [
		"a0_g_apl",
		"a1_h_apl",
		"a2_i_apl",
		"a3_j_apl",
		"g",
		"h",
		"i",
		"j",
		"cpcor",
		"ctcor",
		"wbotc",
		"pa0",
		"pa1",
		"pa2",
		"ptha0",
		"ptha1",
		"ptha2",
		"ptca0",
		"ptca1",
		"ptca2",
		"ptcb0",
		"ptcb1",
		"ptcb2",
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
		"calibcomm",
		"sbe_cond_freq_min",
		"sbe_cond_freq_max",
		"sbe_temp_freq_min",
		"sbe_temp_freq_max",
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
	],
	// No known coefficients yet -- see gateway's asset-tables.ts.
	mr_sensor: [],
};

// The "sensor" asset_type_group, in display order -- the only types with
// a calibration table that are science sensors (slocum_forward_section
// also has one but is structural, excluded from the Calibrations
// catalogue).
export const SCIENCE_ASSET_TYPES = [
	"ct_sensor",
	"do_sensor",
	"eco_sensor",
	"mr_sensor",
];

// Empty string -> omit the field entirely (leaves the column NULL).
// Otherwise a valid-looking number is coerced to a real number so it's
// stored numerically, same as the paste-parser's coerceValue.
export function coerceCalibrationInput(raw: string): number | string {
	const trimmed = raw.trim();
	const num = Number(trimmed);
	if (trimmed !== "" && !Number.isNaN(num)) return num;
	return trimmed;
}
