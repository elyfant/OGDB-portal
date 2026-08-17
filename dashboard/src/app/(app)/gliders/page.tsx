import GlidersTable from "@/components/GlidersTable";
import { getGliders, getStatusOptions } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default async function GlidersPage() {
	const [gliders, statusOptions, user] = await Promise.all([
		getGliders(),
		getStatusOptions(),
		getCurrentUser(),
	]);
	const canEdit = user?.role === "editor" || user?.role === "admin";

	return (
		<Box>
			<Typography variant="h5" sx={{ mb: 2 }}>
				Glider fleet
			</Typography>
			<GlidersTable
				gliders={gliders}
				statusOptions={statusOptions}
				canEdit={canEdit}
			/>
		</Box>
	);
}
