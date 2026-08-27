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

	// Batteries only -- asset_battery_details.battery_model_id. Ignored
	// server-side for any other asset type (same pattern as l22ModelId).
	@IsOptional()
	@IsInt()
	batteryModelId?: number;

	// Batteries only -- asset_battery_details.date_of_manufacture.
	@IsOptional()
	@IsDateString()
	dateOfManufacture?: string;

	// Batteries only -- recorded as the first row in the append-only
	// asset_battery_measurements history (asset_battery_measurements.weight).
	@IsOptional()
	@IsNumber()
	weight?: number;
}
