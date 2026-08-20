import type { BuildChange } from "@ogdb/types";
import {
	IsArray,
	IsDateString,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
} from "class-validator";

// missionName is deliberately not a field here -- MissionsService.createMission
// always computes it server-side from glider/project/site/launchDate, the
// same way for every mission, so it can't drift from the naming
// convention or be typed inconsistently by hand.
//
// `buildChanges` isn't deep-validated (discriminated union, same
// reasoning as ApplyBuildChangesDto) -- each entry's shape is checked in
// applyBuildChangesTx before anything is written.
export class CreateMissionDto {
	@IsInt()
	missionNumber!: number;

	@IsInt()
	gliderAssetId!: number;

	@IsInt()
	statusId!: number;

	@IsInt()
	projectId!: number;

	@IsInt()
	siteId!: number;

	@IsDateString()
	launchDate!: string;

	@IsOptional()
	@IsInt()
	principalInvestigatorId?: number | null;

	@IsOptional()
	@IsInt()
	technicalLeadId?: number | null;

	@IsOptional()
	@IsInt()
	operatingAgencyId?: number | null;

	@IsOptional()
	@IsInt()
	fundingAgencyId?: number | null;

	@IsOptional()
	@IsNumber()
	launchLatitude?: number | null;

	@IsOptional()
	@IsNumber()
	launchLongitude?: number | null;

	@IsOptional()
	@IsInt()
	launchCruiseId?: number | null;

	@IsOptional()
	@IsDateString()
	endDateScience?: string | null;

	@IsOptional()
	@IsDateString()
	recoveryDate?: string | null;

	@IsOptional()
	@IsNumber()
	recoveryLatitude?: number | null;

	@IsOptional()
	@IsNumber()
	recoveryLongitude?: number | null;

	@IsOptional()
	@IsInt()
	recoveryCruiseId?: number | null;

	@IsOptional()
	@IsNumber()
	volume?: number | null;

	@IsOptional()
	@IsNumber()
	weightInAir?: number | null;

	@IsOptional()
	@IsNumber()
	density?: number | null;

	@IsOptional()
	@IsInt()
	dives?: number | null;

	@IsOptional()
	@IsNumber()
	distanceKm?: number | null;

	@IsOptional()
	@IsInt()
	iridiumMinutes?: number | null;

	@IsOptional()
	@IsString()
	missionFolderPath?: string | null;

	@IsOptional()
	@IsArray()
	buildChanges?: BuildChange[];
}
