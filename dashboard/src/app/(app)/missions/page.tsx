import MissionFormDialog from "@/components/MissionFormDialog";
import MissionsTable from "@/components/MissionsTable";
import {
	getAgencies,
	getContacts,
	getCruises,
	getGliders,
	getMissionStatuses,
	getMissions,
	getObservatories,
	getProjects,
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
		observatories,
		contacts,
		agencies,
		cruises,
		user,
	] = await Promise.all([
		getMissions(),
		getGliders(),
		getMissionStatuses(),
		getProjects(),
		getObservatories(),
		getContacts(),
		getAgencies(),
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
						observatories={observatories}
						contacts={contacts}
						agencies={agencies}
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
				observatories={observatories}
				contacts={contacts}
				agencies={agencies}
				cruises={cruises}
			/>
		</Box>
	);
}
