"use client";

import EditIcon from "@mui/icons-material/Edit";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";
import type { Cruise, Glider, LookupOption, Mission } from "@ogdb/types";
import { useMemo, useState } from "react";
import { MISSION_COLUMNS } from "../lib/mission-columns";
import { buildMissionFilters } from "../lib/mission-filters";
import { oceanOpsPlatformUrl } from "../lib/oceanops";
import {
	type FilterState,
	applyFilters,
	isFilterActive,
} from "../lib/table-filters";
import DataTable from "./DataTable";
import FilterBar from "./FilterBar";
import MissionFormDialog from "./MissionFormDialog";

function rowSx(status: string | null): SxProps<Theme> | undefined {
	if (status === "active")
		return { backgroundColor: "rgba(76, 175, 80, 0.16)" };
	if (status === "scheduled")
		return { backgroundColor: "rgba(255, 152, 0, 0.16)" };
	return undefined;
}

export default function MissionsTable({
	missions,
	canEdit,
	gliders,
	missionStatuses,
	endingCauses,
	projects,
	observatories,
	contacts,
	agencies,
	cruises,
}: {
	missions: Mission[];
	canEdit: boolean;
	gliders: Glider[];
	missionStatuses: LookupOption[];
	endingCauses: LookupOption[];
	projects: LookupOption[];
	observatories: LookupOption[];
	contacts: LookupOption[];
	agencies: LookupOption[];
	cruises: Cruise[];
}) {
	const [filterState, setFilterState] = useState<FilterState>({});
	const [editingMission, setEditingMission] = useState<Mission | null>(null);

	// The Passport ID cell links out to the mission's OceanOPS page. The
	// whole row is itself a link to the mission, so the click is stopped
	// from reaching it. Sorting and CSV export still use the raw ID.
	const columns = useMemo(
		() =>
			MISSION_COLUMNS.map((col) =>
				col.key === "wigosId"
					? {
							...col,
							renderCell: (m: Mission) => {
								const url = oceanOpsPlatformUrl(m.wigosId);
								if (!m.wigosId) return "—";
								if (!url) return m.wigosId;
								return (
									<MuiLink
										href={url}
										target="_blank"
										rel="noreferrer"
										onClick={(e) => e.stopPropagation()}
									>
										{m.wigosId}
									</MuiLink>
								);
							},
						}
					: col,
			),
		[],
	);

	const missionFilters = useMemo(
		() =>
			buildMissionFilters({
				observatories,
				projects,
				missionStatuses,
				gliders,
			}),
		[observatories, projects, missionStatuses, gliders],
	);

	const filteredRows = useMemo(
		() => applyFilters(missions, missionFilters, filterState),
		[missions, missionFilters, filterState],
	);

	return (
		<>
			<DataTable<Mission>
				rows={filteredRows}
				columns={columns}
				getRowId={(m) => m.id}
				getRowHref={(m) => `/missions/${m.id}`}
				rowSx={(m) => rowSx(m.status)}
				defaultSort={{ key: "deploymentDate", direction: "desc" }}
				csvFileNameBase="missions"
				renderRowActions={
					canEdit
						? (m) => (
								<Tooltip title="Edit this mission">
									<IconButton
										size="small"
										onClick={(e) => {
											e.stopPropagation();
											setEditingMission(m);
										}}
										onDoubleClick={(e) => e.stopPropagation()}
									>
										<EditIcon fontSize="small" />
									</IconButton>
								</Tooltip>
							)
						: undefined
				}
				toolbarLeft={
					<FilterBar
						rows={missions}
						filters={missionFilters}
						value={filterState}
						onChange={setFilterState}
					/>
				}
				toolbarRight={
					<Typography variant="body2" color="text.secondary">
						Showing {filteredRows.length} of {missions.length} missions
					</Typography>
				}
			/>

			{canEdit && (
				<MissionFormDialog
					mode="edit"
					mission={editingMission}
					onClose={() => setEditingMission(null)}
					missions={missions}
					gliders={gliders}
					missionStatuses={missionStatuses}
					endingCauses={endingCauses}
					projects={projects}
					observatories={observatories}
					contacts={contacts}
					agencies={agencies}
					cruises={cruises}
				/>
			)}
		</>
	);
}
