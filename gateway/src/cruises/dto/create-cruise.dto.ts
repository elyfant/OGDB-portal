import {
	IsDateString,
	IsInt,
	IsOptional,
	IsString,
	MaxLength,
} from "class-validator";

export class CreateCruiseDto {
	@IsString()
	@MaxLength(250)
	cruiseName!: string;

	@IsOptional()
	@IsString()
	@MaxLength(50)
	cruiseNumber?: string;

	@IsOptional()
	@IsInt()
	vesselId?: number;

	@IsOptional()
	@IsInt()
	instituteId?: number;

	@IsOptional()
	@IsString()
	@MaxLength(50)
	cruiseLeader?: string;

	@IsString()
	@MaxLength(50)
	area!: string;

	@IsDateString()
	startDate!: string;

	@IsDateString()
	endDate!: string;

	@IsOptional()
	@IsString()
	@MaxLength(50)
	startPort?: string;

	@IsOptional()
	@IsString()
	@MaxLength(50)
	endPort?: string;
}
