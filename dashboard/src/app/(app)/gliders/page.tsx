import GliderFormDialog from "@/components/GliderFormDialog";
import GlidersTable from "@/components/GlidersTable";
import {
	getAgencies,
	getGliders,
	getPlatforms,
	getServicingRequired,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default async function GlidersPage() {
	const [gliders, platforms, agencies, user, servicingRequired] =
		await Promise.all([
			getGliders(),
			getPlatforms(),
			getAgencies(),
			getCurrentUser(),
			getServicingRequired(),
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
				<Typography variant="h5">Glider fleet</Typography>
				{canEdit && (
					<GliderFormDialog
						mode="create"
						platforms={platforms}
						agencies={agencies}
					/>
				)}
			</Box>
			<Typography variant="subtitle1" color="text.secondary">
				Every glider in the fleet, click on a glider to view its details and
				history.
			</Typography>
			<GlidersTable gliders={gliders} servicingRequired={servicingRequired} />
		</Box>
	);
}
