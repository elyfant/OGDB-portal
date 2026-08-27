"use client";

import EditIcon from "@mui/icons-material/Edit";
import Button from "@mui/material/Button";
import type { Cruise, Glider, LookupOption, Mission } from "@ogdb/types";
import { useState } from "react";
import MissionFormDialog from "./MissionFormDialog";

// The mission detail page's "About mission" box needs the same edit
// dialog MissionsTable opens per-row from the catalogue, just triggered
// by a standalone button instead of a table row's edit icon. missions
// is passed as [] -- MissionFormDialog only uses that list for the
// create-mode autopopulate dropdown and the suggested-mission-number
// calc, neither of which applies in edit mode.
export default function EditMissionButton({
	mission,
	gliders,
	missionStatuses,
	projects,
	sites,
	contacts,
	institutes,
	cruises,
}: {
	mission: Mission;
	gliders: Glider[];
	missionStatuses: LookupOption[];
	projects: LookupOption[];
	sites: LookupOption[];
	contacts: LookupOption[];
	institutes: LookupOption[];
	cruises: Cruise[];
}) {
	const [editing, setEditing] = useState(false);

	return (
		<>
			<Button
				size="small"
				variant="outlined"
				startIcon={<EditIcon fontSize="small" />}
				onClick={() => setEditing(true)}
			>
				Edit mission
			</Button>
			<MissionFormDialog
				mode="edit"
				mission={editing ? mission : null}
				onClose={() => setEditing(false)}
				missions={[]}
				gliders={gliders}
				missionStatuses={missionStatuses}
				projects={projects}
				sites={sites}
				contacts={contacts}
				institutes={institutes}
				cruises={cruises}
			/>
		</>
	);
}
