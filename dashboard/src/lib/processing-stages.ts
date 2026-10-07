import type { DatasetProcessingStage } from "@ogdb/types";

// One place for the processing-stage labels (OGDB's
// dataset_processing_stages.stage codes -- see xxxx_processing_stages_qc_levels).
export const STAGE_LABEL: Record<DatasetProcessingStage, string> = {
	raw: "Raw data archival",
	L0: "L0 dataset",
	BASESTATION: "Basestation (auto, during mission)",
	AUTO_QC: "Reprocessed, auto-QC",
	MANUAL_QC: "Reprocessed, auto + manual QC",
};

export function stageLabel(stage: string | null | undefined): string {
	if (!stage) return "—";
	return STAGE_LABEL[stage as DatasetProcessingStage] ?? stage;
}
