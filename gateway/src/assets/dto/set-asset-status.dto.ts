import { IsInt, IsOptional, IsString } from "class-validator";

export class SetAssetStatusDto {
	@IsInt()
	statusId!: number;

	@IsOptional()
	@IsString()
	notes?: string;
}
