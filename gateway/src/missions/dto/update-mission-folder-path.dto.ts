import { IsOptional, IsString } from "class-validator";

export class UpdateMissionFolderPathDto {
	@IsOptional()
	@IsString()
	missionFolderPath?: string | null;
}
