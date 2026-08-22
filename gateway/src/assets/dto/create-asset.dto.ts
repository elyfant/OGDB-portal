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
}
