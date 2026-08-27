// Mirrors gateway/src/common/asset-tables.ts's CAL_COLUMNS, minus
// calibration_facility (the Add-calibration dialog gives that its own
// field). Duplicated because gateway and dashboard don't share a runtime
// module -- only @ogdb/types is shared between them. Keep in sync by
// hand, same convention already accepted for SLOCUM_ONLY_CHILD_TYPES
// elsewhere in this project.
export const CAL_FIELDS: Record<string, string[]> = {
	// sbe_temp_g/h/i/j (CT-Sail) and sbe_temp_a0-a3 (GPCTD) are genuinely
	// different column sets, not two names for the same channel -- see
	// gateway's asset-tables.ts.
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
		// phasecoef0-3 and conccoef0-1 (Offset/Slope): see asset-tables.ts's
		// CAL_COLUMNS.do_sensor for why these were added.
		"phasecoef0",
		"phasecoef1",
		"phasecoef2",
		"phasecoef3",
		"conccoef0",
		"conccoef1",
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
		// bb2_*: second backscatter wavelength on a BB2-type sensor -- see
		// asset-tables.ts's CAL_COLUMNS.eco_sensor for why these were added.
		"bb2_wl",
		"bb2_sf",
		"bb2_maxoutput",
		"bb2_dc",
		"bb2_res_counts",
		"bb2_res_sf",
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
