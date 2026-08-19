import type { BuildChange } from "@ogdb/types";
import {
	IsArray,
	IsDateString,
	IsInt,
	IsOptional,
	IsString,
} from "class-validator";

// `changes` is intentionally not deep-validated here (it's a discriminated
// union, awkward to express with class-validator decorators) -- each
// entry's shape is checked in GlidersService.applyBuildChanges before
// anything is written, with a clear error per malformed entry.
export class ApplyBuildChangesDto {
	@IsDateString()
	effectiveDate!: string;

	@IsOptional()
	@IsInt()
	missionId?: number;

	@IsOptional()
	@IsString()
	notes?: string;

	@IsArray()
	changes!: BuildChange[];
}
