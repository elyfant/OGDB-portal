import type { Cruise } from "@ogdb/types";
import type { ColumnDef } from "./data-table";

export const CRUISE_COLUMNS: ColumnDef<Cruise>[] = [
	{
		key: "cruiseName",
		label: "Cruise name",
		kind: "string",
		defaultVisible: true,
	},
	{
		key: "cruiseNumber",
		label: "Cruise number",
		kind: "string",
		defaultVisible: true,
	},
	{ key: "vessel", label: "Vessel", kind: "string", defaultVisible: true },
	{
		key: "institute",
		label: "Institute",
		kind: "string",
		defaultVisible: true,
	},
	{
		key: "cruiseLeader",
		label: "Cruise leader",
		kind: "string",
		defaultVisible: true,
	},
	{ key: "area", label: "Area", kind: "string", defaultVisible: true },
	{
		key: "startDate",
		label: "Start date",
		kind: "date",
		defaultVisible: true,
	},
	{
		key: "startPort",
		label: "Start port",
		kind: "string",
		defaultVisible: true,
	},
	{ key: "endDate", label: "End date", kind: "date", defaultVisible: true },
	{ key: "endPort", label: "End port", kind: "string", defaultVisible: true },
	{
		key: "id",
		label: "Record ID",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
];
