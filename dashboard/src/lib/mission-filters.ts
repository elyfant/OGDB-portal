import type { Glider, LookupOption, Mission } from "@ogdb/types";
import type { FilterDef } from "./table-filters";

function toOptions(lookups: LookupOption[]) {
	return [...lookups]
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((l) => ({ value: String(l.id), label: l.name }));
}

export function buildMissionFilters({
	sites,
	projects,
	missionStatuses,
	gliders,
}: {
	sites: LookupOption[];
	projects: LookupOption[];
	missionStatuses: LookupOption[];
	gliders: Glider[];
}): FilterDef<Mission>[] {
	return [
		{
			key: "site",
			label: "Site",
			type: "multiSelect",
			getValue: (m) => m.siteId,
			options: toOptions(sites),
		},
		{
			key: "project",
			label: "Project",
			type: "multiSelect",
			getValue: (m) => m.projectId,
			options: toOptions(projects),
		},
		{
			key: "status",
			label: "Status",
			type: "multiSelect",
			getValue: (m) => m.statusId,
			options: toOptions(missionStatuses),
		},
		{
			key: "glider",
			label: "Glider",
			type: "multiSelect",
			getValue: (m) => m.gliderAssetId,
			options: [...gliders]
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((g) => ({ value: String(g.id), label: g.name })),
		},
		{
			key: "launchDate",
			label: "Launch date",
			type: "dateRange",
			getValue: (m) => m.launchDate,
		},
	];
}
