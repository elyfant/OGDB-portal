import type { ErddapLevel, ErddapPushStatus } from "@ogdb/types";
import { IsIn, IsOptional, IsString } from "class-validator";

export class ConfirmErddapPushDto {
	@IsIn(["L1", "L2"])
	level!: ErddapLevel;

	@IsIn(["none", "BASESTATION", "AUTO_QC", "MANUAL_QC"])
	status!: ErddapPushStatus;

	// The internal file that was pushed (relative to the shared projects
	// folder, as stored on the processing run). Optional: without it, the
	// push is linked to the latest run of `status` that has a file for
	// `level`. The ERDDAP push script always sends it.
	@IsOptional()
	@IsString()
	file?: string;
}
