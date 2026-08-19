import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateProcessingPackageVersionDto {
	@IsString()
	@MaxLength(100)
	versionLabel!: string;

	@IsOptional()
	@IsString()
	versionUrl?: string | null;
}
