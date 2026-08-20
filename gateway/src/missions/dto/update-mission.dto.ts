import { CreateMissionDto } from "./create-mission.dto";

// Identical field set to CreateMissionDto -- editing a mission touches
// the same columns creating one does, just against an existing row.
// mission_name is still never client-submitted; MissionsService.updateMission
// recomputes it the same way createMission does, from whatever
// glider/project/site/launchDate the edit ends up with.
export class UpdateMissionDto extends CreateMissionDto {}
