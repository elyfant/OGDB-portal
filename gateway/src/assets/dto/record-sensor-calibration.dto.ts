import { Transform } from "class-transformer";
import { IsDateString, IsObject } from "class-validator";

// `coefficients` isn't deep-validated here (keys vary entirely by asset
// type) -- AssetsService.recordCalibration whitelists every key against
// CAL_COLUMNS before it ever reaches SQL.
//
// This endpoint is always called as multipart/form-data now (so an
// optional certificate file can ride along) -- coefficients arrives as
// a JSON-stringified form field rather than a real nested object, so it
// needs parsing before @IsObject() sees it. Plain JSON callers (there
// are none left, but nothing stops one) still work: the transform is a
// no-op when the value already isn't a string.
export class RecordSensorCalibrationDto {
	@IsDateString()
	calDate!: string;

	@Transform(({ value }) =>
		typeof value === "string" ? JSON.parse(value) : value,
	)
	@IsObject()
	coefficients!: Record<string, number | string | null>;
}
