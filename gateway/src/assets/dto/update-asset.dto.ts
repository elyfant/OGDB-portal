import { OmitType, PartialType } from "@nestjs/mapped-types";
import { IsInt, IsOptional } from "class-validator";
import { CreateAssetDto } from "./create-asset.dto";

// assetTypeId rides along as optional (PartialType makes every
// CreateAssetDto field optional) but AssetsService.update never reads
// it -- changing what type an asset is after creation is a structural
// change this form doesn't support, same as gliders not letting
// glider-vs-non-glider change through UpdateGliderDto.
//
// l22ModelId is omitted from the base rather than inherited as-is: the
// create-time field is a plain optional number (absent = no model),
// but the edit-time field needs a genuine three-state
// absent/null/number (absent = don't touch, null = clear it -- see
// AssetsService.update), which PartialType's Partial<> can't widen to
// on its own.
export class UpdateAssetDto extends PartialType(
	OmitType(CreateAssetDto, ["l22ModelId"] as const),
) {
	// Science sensors only (asset_sensor_details.l22_model_id) -- absent
	// means "don't touch", explicit null means "clear it". IsOptional
	// skips further validation for both null and undefined, so a real
	// value still gets IsInt-checked.
	@IsOptional()
	@IsInt()
	l22ModelId?: number | null;
}
