import type { BuildChange } from "@ogdb/types";
import { Transform } from "class-transformer";
import {
	IsArray,
	IsDateString,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	Matches,
} from "class-validator";

// missions.l1_file / l2_file hold a path INSIDE the shared GFI projects
// folder (e.g. naco/data/delayed/095-.../basestation/x.nc), or a URL --
// never one machine's absolute path, since everyone mounts that folder
// somewhere different. OGDB enforces this with a CHECK constraint
// (xxxx_mission_file_paths_relative); this gives the user a readable 400
// instead of the database's 500. Whitespace is trimmed and an empty box
// becomes NULL first, matching what the constraint allows.
const trimToNull = ({ value }: { value: unknown }) =>
	typeof value === "string" ? value.trim() || null : value;
const NOT_ABSOLUTE = /^(?![/\\]|[A-Za-z]:)/;
const fileMessage = (label: string) =>
	`${label} must be a path inside the shared projects folder, e.g. naco/data/delayed/095-.../basestation/file.nc (without /Data/gfi/projects/ or a drive letter in front), or a URL.`;

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

	@Transform(trimToNull)
	@IsOptional()
	@IsString()
	@Matches(NOT_ABSOLUTE, { message: fileMessage("L1 file") })
	l1File?: string | null;

	@Transform(trimToNull)
	@IsOptional()
	@IsString()
	@Matches(NOT_ABSOLUTE, { message: fileMessage("L2 file") })
	l2File?: string | null;

	@IsOptional()
	@IsArray()
	buildChanges?: BuildChange[];
}
