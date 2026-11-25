import {
	IsDateString,
	IsInt,
	IsOptional,
	IsString,
	MaxLength,
} from "class-validator";

// POST /assets/:id/locations. Appends a row to asset_location_history
// ("current = latest by date"), never edits an earlier one.
export class RecordAssetLocationDto {
	@IsInt()
	locationId!: number;

	// The day it was there. Defaults to today; can't be in the future.
	@IsOptional()
	@IsDateString()
	effectiveDate?: string | null;

	@IsOptional()
	@IsString()
	@MaxLength(500)
	note?: string | null;
}
