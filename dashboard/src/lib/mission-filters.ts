import type { Glider, LookupOption, Mission } from "@ogdb/types";
import type { FilterDef } from "./table-filters";

function toOptions(lookups: LookupOption[]) {
	return [...lookups]
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((l) => ({ value: String(l.id), label: l.name }));
}

export function buildMissionFilters({
	observatories,
	projects,
	missionStatuses,
	gliders,
}: {
	observatories: LookupOption[];
	projects: LookupOption[];
	missionStatuses: LookupOption[];
	gliders: Glider[];
}): FilterDef<Mission>[] {
	return [
		{
			key: "observatory",
			label: "Observatory",
			type: "multiSelect",
			getValue: (m) => m.observatoryId,
			options: toOptions(observatories),
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
			key: "deploymentDate",
			label: "Deployment date",
			type: "dateRange",
			getValue: (m) => m.deploymentDate,
		},
	];
}
