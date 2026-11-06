import { IsInt } from "class-validator";

export class CopyMissionBuildDto {
	@IsInt()
	sourceMissionId!: number;
}
