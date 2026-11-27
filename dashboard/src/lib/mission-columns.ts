import type { Mission } from "@ogdb/types";
import { type ColumnDef, defaultVisibleColumns } from "./data-table";

export const MISSION_COLUMNS: ColumnDef<Mission>[] = [
	{
		key: "missionNumber",
		label: "Mission #",
		kind: "number",
		defaultVisible: true,
	},
	{
		key: "wigosId",
		label: "Passport ID",
		headerInfo:
			"OceanOPS Passport ID: the mission's WIGOS Station Identifier (WSI). Empty until the mission is registered with OceanOPS.",
		kind: "string",
		defaultVisible: true,
	},
	{
		key: "missionName",
		label: "Mission name",
		kind: "string",
		defaultVisible: false,
	},
	{
		key: "stdMissionName",
		label: "Std. mission name",
		kind: "string",
		defaultVisible: true,
	},
	{
		// Shown as the lifecycle chip (Workshop / Scheduled / Active / Ended); the
		// raw stored status is still what sorts and exports.
		key: "status",
		label: "Lifecycle",
		kind: "string",
		defaultVisible: true,
		capitalize: true,
	},
	{
		// Why an ended mission ended; shown as a coloured chip ("Normal" for a
		// voluntary recovery). Empty until a cause is chosen in the edit dialog.
		key: "endingCause",
		label: "Cause of ending",
		kind: "string",
		defaultVisible: true,
	},
	{
		key: "glider",
		label: "Glider",
		kind: "string",
		defaultVisible: true,
		capitalize: true,
	},
	{
		key: "project",
		label: "Project",
		kind: "string",
		defaultVisible: true,
		capitalize: true,
	},
	{
		key: "observatory",
		label: "Observatory",
		kind: "string",
		defaultVisible: true,
	},
	{ key: "pi", label: "PI", kind: "string", defaultVisible: true },
	{
		key: "operationsManager",
		label: "Operations manager",
		kind: "string",
		defaultVisible: false,
	},
	{
		key: "platform",
		label: "Platform",
		kind: "string",
		defaultVisible: false,
		capitalize: true,
	},
	{
		key: "operatingAgency",
		label: "Operating agency",
		kind: "string",
		defaultVisible: false,
	},
	{
		key: "fundingAgency",
		label: "Funding agency",
		kind: "string",
		defaultVisible: false,
	},
	{
		key: "deploymentDate",
		label: "Deployment date",
		kind: "date",
		defaultVisible: true,
	},
	{
		key: "deploymentLatitude",
		label: "Deployment latitude",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
	{
		key: "deploymentLongitude",
		label: "Deployment longitude",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
	{
		key: "endDateScience",
		label: "End of science date",
		kind: "date",
		defaultVisible: false,
	},
	{
		key: "retrievalDate",
		label: "Retrieval date",
		kind: "date",
		defaultVisible: true,
	},
	{
		key: "retrievalLatitude",
		label: "Retrieval latitude",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
	{
		key: "retrievalLongitude",
		label: "Retrieval longitude",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
	{
		key: "dives",
		label: "Dives",
		kind: "number",
		defaultVisible: true,
		align: "right",
	},
	{
		key: "distanceKm",
		label: "Distance (km)",
		kind: "number",
		defaultVisible: true,
		align: "right",
	},
	{
		key: "numberOfDays",
		label: "Days",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
	{
		key: "volume",
		label: "Volume",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
	{
		key: "weightInAir",
		label: "Weight in air",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
	{
		key: "density",
		label: "Density",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
	{
		key: "iridiumMinutes",
		label: "Iridium minutes",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
	{
		key: "deploymentCruiseId",
		label: "Deployment cruise ID",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
	{
		key: "retrievalCruiseId",
		label: "Retrieval cruise ID",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
	{
		key: "id",
		label: "Record ID",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
];

export const DEFAULT_VISIBLE_COLUMNS = defaultVisibleColumns(MISSION_COLUMNS);
