import { IsString, MaxLength } from "class-validator";

export class CreateProcessingPackageDto {
	@IsString()
	@MaxLength(100)
	name!: string;
}
