import { OmitType, PartialType } from "@nestjs/mapped-types";
import { IsDateString, IsInt, IsOptional } from "class-validator";
import { CreateAssetDto } from "./create-asset.dto";

// assetTypeId rides along as optional (PartialType makes every
// CreateAssetDto field optional) but AssetsService.update never reads
// it -- changing what type an asset is after creation is a structural
// change this form doesn't support, same as gliders not letting
// glider-vs-non-glider change through UpdateGliderDto.
//
// l22ModelId, instituteId, batteryModelId and dateOfManufacture are
// omitted from the base rather than inherited as-is: the create-time
// fields are plain optionals (absent = none), but the edit-time fields
// need a genuine three-state absent/null/value (absent = don't touch,
// null = clear it -- see AssetsService.update), which PartialType's
// Partial<> can't widen to on its own.
export class UpdateAssetDto extends PartialType(
	OmitType(CreateAssetDto, [
		"l22ModelId",
		"instituteId",
		"batteryModelId",
		"dateOfManufacture",
	] as const),
) {
	// Science sensors only (asset_sensor_details.l22_model_id) -- absent
	// means "don't touch", explicit null means "clear it". IsOptional
	// skips further validation for both null and undefined, so a real
	// value still gets IsInt-checked.
	@IsOptional()
	@IsInt()
	l22ModelId?: number | null;

	// assets.institute_id.
	@IsOptional()
	@IsInt()
	instituteId?: number | null;

	// Batteries only -- asset_battery_details.battery_model_id and
	// .date_of_manufacture.
	@IsOptional()
	@IsInt()
	batteryModelId?: number | null;

	@IsOptional()
	@IsDateString()
	dateOfManufacture?: string | null;
}
