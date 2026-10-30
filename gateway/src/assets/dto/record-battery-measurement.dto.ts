import { IsDateString, IsNumber, IsOptional } from "class-validator";

// One row of asset_battery_measurements. At least one of weight/voltage
// is required -- enforced in AssetsService, since "at least one of" isn't
// expressible per-field here. measuredDate defaults to today (the
// column's own default) when omitted.
export class RecordBatteryMeasurementDto {
	@IsOptional()
	@IsDateString()
	measuredDate?: string;

	@IsOptional()
	@IsNumber()
	weight?: number;

	@IsOptional()
	@IsNumber()
	voltage?: number;
}
