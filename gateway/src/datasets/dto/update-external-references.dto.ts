import { IsOptional, IsString } from "class-validator";

export class UpdateExternalReferencesDto {
	@IsOptional()
	@IsString()
	doi?: string | null;

	@IsOptional()
	@IsString()
	oceanOpsBoardUrl?: string | null;

	@IsOptional()
	@IsString()
	erddapL1Url?: string | null;

	@IsOptional()
	@IsString()
	erddapL2Url?: string | null;

	@IsOptional()
	@IsString()
	coriolisUrl?: string | null;
}
