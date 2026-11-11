import {
	IsDateString,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
} from "class-validator";

// L1/L2 NetCDF files are deliberately not fields here either: they live on
// the processing runs (dataset_processing_stages, set by the ingest scripts)
// and the mission's best file is computed (mission_best_files).
//
// missionName is deliberately not a field here -- MissionsService.createMission
// always computes it server-side from glider/project/observatory/deploymentDate, the
// same way for every mission, so it can't drift from the naming
// convention or be typed inconsistently by hand.
//
// `buildChanges` isn't deep-validated (discriminated union, same
// reasoning as ApplyBuildChangesDto) -- each entry's shape is checked in
// applyBuildChangesTx before anything is written.
export class CreateMissionDto {
	// Optional: a workshop/scheduled mission has none; it is assigned when the
	// mission becomes active (or entered here for a historical mission).
	@IsOptional()
	@IsInt()
	missionNumber?: number | null;

	@IsInt()
	gliderAssetId!: number;

	@IsInt()
	statusId!: number;

	// Required or not depending on status -- see
	// MissionsService.assertFieldsForStatus.
	@IsOptional()
	@IsInt()
	projectId?: number | null;

	@IsOptional()
	@IsInt()
	observatoryId?: number | null;

	@IsOptional()
	@IsDateString()
	deploymentDate?: string | null;

	@IsOptional()
	@IsInt()
	principalInvestigatorId?: number | null;

	@IsOptional()
	@IsInt()
	operationsManagerId?: number | null;

	@IsOptional()
	@IsInt()
	operatingAgencyId?: number | null;

	@IsOptional()
	@IsInt()
	fundingAgencyId?: number | null;

	@IsOptional()
	@IsNumber()
	deploymentLatitude?: number | null;

	@IsOptional()
	@IsNumber()
	deploymentLongitude?: number | null;

	@IsOptional()
	@IsInt()
	deploymentCruiseId?: number | null;

	@IsOptional()
	@IsDateString()
	endDateScience?: string | null;

	@IsOptional()
	@IsDateString()
	retrievalDate?: string | null;

	@IsOptional()
	@IsNumber()
	retrievalLatitude?: number | null;

	@IsOptional()
	@IsNumber()
	retrievalLongitude?: number | null;

	@IsOptional()
	@IsInt()
	retrievalCruiseId?: number | null;

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
}
