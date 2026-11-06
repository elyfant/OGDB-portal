import type { BuildChange } from "@ogdb/types";
import { IsArray, IsOptional, IsString } from "class-validator";

// `changes` is intentionally not deep-validated here (it's a discriminated
// union, awkward to express with class-validator decorators) -- each
// entry's shape is checked in applyMissionBuildChangesTx before anything
// is written, with a clear error per malformed entry.
export class ApplyMissionBuildChangesDto {
	@IsOptional()
	@IsString()
	notes?: string;

	@IsArray()
	changes!: BuildChange[];
}
