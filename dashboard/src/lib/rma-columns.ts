import { formatAssetType } from "@/lib/format";
import type { RmaCatalogueRow } from "@ogdb/types";
import type { ColumnDef } from "./data-table";

const STAGE_LABEL: Record<string, string> = {
	opened: "Opened",
	shipped_out: "Shipped out",
	received_by_repairer: "Received by repairer",
	status_update: "Status update",
	escalated_to_manufacturer: "Escalated to manufacturer",
	shipping_issue: "Shipping issue",
	received_by_manufacturer: "Received by manufacturer",
	returned: "Returned",
	closed: "Closed",
};

export function formatRmaStage(stage: string): string {
	return STAGE_LABEL[stage] ?? formatAssetType(stage);
}

export const RMA_COLUMNS: ColumnDef<RmaCatalogueRow>[] = [
	{
		key: "rmaNumber",
		label: "RMA #",
		kind: "string",
		defaultVisible: true,
	},
	{
		key: "manufacturerName",
		label: "Manufacturer",
		kind: "string",
		defaultVisible: true,
	},
	{
		key: "openedDate",
		label: "Opened",
		kind: "date",
		defaultVisible: true,
	},
	{
		key: "currentStage",
		label: "Current stage",
		kind: "string",
		defaultVisible: true,
		format: (v) => formatRmaStage(String(v)),
	},
	{
		key: "assetCount",
		label: "Assets",
		kind: "number",
		defaultVisible: true,
		align: "right",
	},
	{
		key: "assetSerials",
		label: "Serial numbers",
		kind: "string",
		defaultVisible: true,
		format: (v) => (Array.isArray(v) ? v.join(", ") : ""),
	},
	{
		key: "open",
		label: "Status",
		kind: "boolean",
		defaultVisible: true,
		format: (v) => (v ? "Open" : "Closed"),
	},
];
