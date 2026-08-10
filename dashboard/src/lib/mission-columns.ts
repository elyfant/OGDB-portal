import type { Mission } from "@ogdb/types";

export type MissionColumnKind = "string" | "number" | "date";

export interface MissionColumnDef {
	key: keyof Mission;
	label: string;
	kind: MissionColumnKind;
	defaultVisible: boolean;
	align?: "right";
	/** Capitalize the first letter for display — only for known lowercase single-word/phrase fields, not slugs like std_mission_name. */
	capitalize?: boolean;
}

export const MISSION_COLUMNS: MissionColumnDef[] = [
	{
		key: "missionNumber",
		label: "Mission #",
		kind: "number",
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
		key: "status",
		label: "Status",
		kind: "string",
		defaultVisible: true,
		capitalize: true,
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
	{ key: "site", label: "Site", kind: "string", defaultVisible: true },
	{ key: "pi", label: "PI", kind: "string", defaultVisible: true },
	{ key: "tech", label: "Tech", kind: "string", defaultVisible: false },
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
		key: "launchDate",
		label: "Launch date",
		kind: "date",
		defaultVisible: true,
	},
	{
		key: "launchLatitude",
		label: "Launch latitude",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
	{
		key: "launchLongitude",
		label: "Launch longitude",
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
		key: "recoveryDate",
		label: "Recovery date",
		kind: "date",
		defaultVisible: true,
	},
	{
		key: "recoveryLatitude",
		label: "Recovery latitude",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
	{
		key: "recoveryLongitude",
		label: "Recovery longitude",
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
		key: "launchCruiseId",
		label: "Launch cruise ID",
		kind: "number",
		defaultVisible: false,
		align: "right",
	},
	{
		key: "recoveryCruiseId",
		label: "Recovery cruise ID",
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

export const DEFAULT_VISIBLE_COLUMNS = MISSION_COLUMNS.filter(
	(c) => c.defaultVisible,
).map((c) => c.key);

export function formatMissionValue(
	value: Mission[keyof Mission],
	column: MissionColumnDef,
): string {
	if (value === null || value === undefined || value === "") return "—";
	if (column.kind === "date") {
		return new Date(value as string).toLocaleDateString("en-GB", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	}
	if (column.kind === "number") {
		return (value as number).toLocaleString("en-GB", {
			maximumFractionDigits: 2,
		});
	}
	if (typeof value === "string") {
		return column.capitalize
			? value.charAt(0).toUpperCase() + value.slice(1)
			: value;
	}
	return String(value);
}
