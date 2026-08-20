import MissionFormDialog from "@/components/MissionFormDialog";
import MissionsTable from "@/components/MissionsTable";
import {
	getContacts,
	getCruises,
	getGliders,
	getInstitutes,
	getMissionStatuses,
	getMissions,
	getProjects,
	getSites,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default async function MissionsPage() {
	const [
		missions,
		gliders,
		missionStatuses,
		projects,
		sites,
		contacts,
		institutes,
		cruises,
		user,
	] = await Promise.all([
		getMissions(),
		getGliders(),
		getMissionStatuses(),
		getProjects(),
		getSites(),
		getContacts(),
		getInstitutes(),
		getCruises(),
		getCurrentUser(),
	]);
	const canEdit = user?.role === "editor" || user?.role === "admin";

	return (
		<Box>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					mb: 2,
				}}
			>
				<Typography variant="h5">Missions</Typography>
				{canEdit && (
					<MissionFormDialog
						mode="create"
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
			</Box>
			<MissionsTable
				missions={missions}
				canEdit={canEdit}
				gliders={gliders}
				missionStatuses={missionStatuses}
				projects={projects}
				sites={sites}
				contacts={contacts}
				institutes={institutes}
				cruises={cruises}
			/>
		</Box>
	);
}
