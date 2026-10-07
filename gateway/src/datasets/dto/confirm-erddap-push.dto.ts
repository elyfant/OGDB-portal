import type { ErddapLevel, ErddapPushStatus } from "@ogdb/types";
import { IsIn } from "class-validator";

export class ConfirmErddapPushDto {
	@IsIn(["L1", "L2"])
	level!: ErddapLevel;

	@IsIn(["none", "AUTO_QC", "MANUAL_QC"])
	status!: ErddapPushStatus;
}
