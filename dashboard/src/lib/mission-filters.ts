import type { Glider, LookupOption, Mission } from "@ogdb/types";
import {
	LIFECYCLE_LABEL,
	endingCauseChip,
	missionLifecycle,
} from "./mission-lifecycle";
import type { FilterDef } from "./table-filters";

function toOptions(lookups: LookupOption[]) {
	return [...lookups]
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((l) => ({ value: String(l.id), label: l.name }));
}

export function buildMissionFilters({
	observatories,
	projects,
	gliders,
}: {
	observatories: LookupOption[];
	projects: LookupOption[];
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
			// The mission's lifecycle (Workshop / Scheduled / Active / Ended), not the
			// stored status: recovered, killed and missing in action are all "Ended".
			key: "lifecycle",
			label: "Lifecycle",
			type: "multiSelect",
			getValue: (m) => missionLifecycle(m.status),
			options: (
				Object.keys(LIFECYCLE_LABEL) as (keyof typeof LIFECYCLE_LABEL)[]
			).map((l) => ({ value: l, label: LIFECYCLE_LABEL[l] })),
		},
		{
			// Why an ended mission ended; options come from the causes in use.
			key: "endingCause",
			label: "Cause of ending",
			type: "multiSelect",
			getValue: (m) => endingCauseChip(m)?.label ?? null,
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
