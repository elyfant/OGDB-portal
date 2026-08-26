import {
	IsDateString,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	MaxLength,
} from "class-validator";

export class CreateAssetDto {
	@IsInt()
	assetTypeId!: number;

	@IsOptional()
	@IsString()
	@MaxLength(100)
	serialNumber?: string;

	@IsOptional()
	@IsString()
	notes?: string;

	@IsOptional()
	@IsDateString()
	purchaseDate?: string;

	@IsOptional()
	@IsNumber()
	purchaseValueUsd?: number;

	@IsOptional()
	@IsInt()
	instituteId?: number;

	// Science sensors only (ct/do/eco/mr_sensor) -- asset_sensor_details.
	// l22_model_id. AssetsService.create ignores this for any other
	// asset type, same guard SENSOR_TYPES already provides elsewhere.
	@IsOptional()
	@IsInt()
	l22ModelId?: number;
}
