import { IsInt, IsOptional } from "class-validator";
import { CreateMissionDto } from "./create-mission.dto";

// Identical field set to CreateMissionDto -- editing a mission touches
// the same columns creating one does, just against an existing row.
// mission_name is still never client-submitted; MissionsService.updateMission
// recomputes it the same way createMission does, from whatever
// glider/project/observatory/deploymentDate the edit ends up with.
//
// One addition: endingCauseId, why the mission ended. It is edit-only --
// a mission that is being created has not ended -- so it is deliberately
// not on CreateMissionDto (the ValidationPipe's whitelist drops it from a
// create request).
export class UpdateMissionDto extends CreateMissionDto {
	@IsOptional()
	@IsInt()
	endingCauseId?: number | null;
}
