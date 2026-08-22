"use client";

import EditIcon from "@mui/icons-material/Edit";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { SxProps, Theme } from "@mui/material/styles";
import type { Cruise, Glider, LookupOption, Mission } from "@ogdb/types";
import { useMemo, useState } from "react";
import { TOOLBAR_CONTROL_HEIGHT } from "../lib/data-table";
import { MISSION_COLUMNS } from "../lib/mission-columns";
import { buildMissionFilters } from "../lib/mission-filters";
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
	projects,
	sites,
	contacts,
	institutes,
	cruises,
}: {
	missions: Mission[];
	canEdit: boolean;
	gliders: Glider[];
	missionStatuses: LookupOption[];
	projects: LookupOption[];
	sites: LookupOption[];
	contacts: LookupOption[];
	institutes: LookupOption[];
	cruises: Cruise[];
}) {
	const [filterState, setFilterState] = useState<FilterState>({});
	const [editingMission, setEditingMission] = useState<Mission | null>(null);

	const missionFilters = useMemo(
		() => buildMissionFilters({ sites, projects, missionStatuses, gliders }),
		[sites, projects, missionStatuses, gliders],
	);

	const filteredRows = useMemo(
		() => applyFilters(missions, missionFilters, filterState),
		[missions, missionFilters, filterState],
	);

	const hasActiveFilters = missionFilters.some((f) =>
		isFilterActive(f, filterState[f.key]),
	);

	return (
		<>
			<DataTable<Mission>
				rows={filteredRows}
				columns={MISSION_COLUMNS}
				getRowId={(m) => m.id}
				getRowHref={(m) => `/missions/${m.id}`}
				rowSx={(m) => rowSx(m.status)}
				defaultSort={{ key: "launchDate", direction: "desc" }}
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
					<>
						<FilterBar
							rows={missions}
							filters={missionFilters}
							value={filterState}
							onChange={setFilterState}
						/>
						{hasActiveFilters && (
							<Button
								size="small"
								sx={{ height: TOOLBAR_CONTROL_HEIGHT }}
								onClick={() => setFilterState({})}
							>
								Clear filters
							</Button>
						)}
					</>
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
					projects={projects}
					sites={sites}
					contacts={contacts}
					institutes={institutes}
					cruises={cruises}
				/>
			)}
		</>
	);
}
