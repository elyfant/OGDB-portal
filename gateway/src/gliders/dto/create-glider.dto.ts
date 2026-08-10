import { IsInt, IsOptional, IsString, MaxLength } from "class-validator";

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
}
