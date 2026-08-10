import { IsInt, IsOptional, IsString } from "class-validator";

export class SetGliderStatusDto {
	@IsInt()
	statusId!: number;

	@IsOptional()
	@IsString()
	notes?: string;
}
