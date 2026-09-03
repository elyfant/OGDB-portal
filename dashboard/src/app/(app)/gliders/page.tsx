import GliderFormDialog from "@/components/GliderFormDialog";
import GlidersTable from "@/components/GlidersTable";
import { getGliders, getInstitutes, getPlatforms } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default async function GlidersPage() {
	const [gliders, platforms, institutes, user] = await Promise.all([
		getGliders(),
		getPlatforms(),
		getInstitutes(),
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
				<Typography variant="h5">Glider fleet</Typography>
				{canEdit && (
					<GliderFormDialog
						mode="create"
						platforms={platforms}
						institutes={institutes}
					/>
				)}
			</Box>
			<Typography variant="subtitle1" color="text.secondary">
				Every glider in the fleet, click on a glider to view its details and
				history.
			</Typography>
			<GlidersTable gliders={gliders} />
		</Box>
	);
}
