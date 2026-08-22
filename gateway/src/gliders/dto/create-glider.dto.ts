import {
	IsDateString,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	MaxLength,
} from "class-validator";

export class CreateGliderDto {
	@IsString()
	@MaxLength(50)
	name!: string;

	@IsOptional()
	@IsString()
	@MaxLength(15)
	wmo?: string;

	@IsOptional()
	@IsInt()
	platformId?: number;

	@IsOptional()
	@IsString()
	@MaxLength(100)
	serialNumber?: string;

	@IsOptional()
	@IsInt()
	instituteId?: number;

	@IsOptional()
	@IsDateString()
	purchaseDate?: string;

	@IsOptional()
	@IsNumber()
	purchaseValueUsd?: number;
}
