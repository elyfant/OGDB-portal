import {
	IsDateString,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	Matches,
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
	purchaseValue?: number;

	// ISO 4217 code (assets.purchase_currency); defaults to USD when
	// omitted on create.
	@IsOptional()
	@Matches(/^[A-Z]{3}$/, {
		message: "purchaseCurrency must be a 3-letter ISO 4217 code",
	})
	purchaseCurrency?: string;

	@IsOptional()
	@IsInt()
	instituteId?: number;

	// Science sensors only (ct/do/eco/mr_sensor) -- asset_sensor_details.
	// l22_model_id. AssetsService.create ignores this for any other
	// asset type, same guard SENSOR_TYPES already provides elsewhere.
	@IsOptional()
	@IsInt()
	l22ModelId?: number;

	// Equipment only (asset_equipment_details) -- what the item is, e.g.
	// "Argos goniometer", and its model/size. Required on create for the
	// equipment type; ignored for every other type.
	@IsOptional()
	@IsString()
	@MaxLength(100)
	equipmentName?: string;

	@IsOptional()
	@IsString()
	@MaxLength(128)
	equipmentModel?: string;

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
