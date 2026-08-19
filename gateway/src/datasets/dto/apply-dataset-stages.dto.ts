import type { RecordDatasetStageInput } from "@ogdb/types";
import { IsArray } from "class-validator";

// `stages` isn't deep-validated here -- each entry's shape (stage name,
// required occurredAt, optional QC block) is checked in
// DatasetsService.applyStages before anything is written, same reasoning
// as ApplyBuildChangesDto's `changes`.
export class ApplyDatasetStagesDto {
	@IsArray()
	stages!: RecordDatasetStageInput[];
}
