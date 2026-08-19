import { IsDateString, IsObject } from "class-validator";

// `coefficients` isn't deep-validated here (keys vary entirely by asset
// type) -- AssetsService.recordCalibration whitelists every key against
// CAL_COLUMNS before it ever reaches SQL.
export class RecordSensorCalibrationDto {
	@IsDateString()
	calDate!: string;

	@IsObject()
	coefficients!: Record<string, number | string | null>;
}
