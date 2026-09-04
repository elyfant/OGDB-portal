import {
	IsDateString,
	IsInt,
	IsOptional,
	IsString,
	MaxLength,
} from "class-validator";

export class CreateRmaDto {
	@IsOptional()
	@IsString()
	@MaxLength(50)
	rmaNumber?: string | null;

	@IsInt()
	manufacturerId!: number;

	@IsDateString()
	openedDate!: string;

	@IsOptional()
	@IsString()
	notes?: string | null;
}
