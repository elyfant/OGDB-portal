import AssetsTable from "@/components/AssetsTable";
import { getAssets, getStatusOptions } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default async function AssetsPage() {
	const [assets, statusOptions, user] = await Promise.all([
		getAssets(),
		getStatusOptions(),
		getCurrentUser(),
	]);
	const canEdit = user?.role === "editor" || user?.role === "admin";

	return (
		<Box>
			<Typography variant="h5" sx={{ mb: 2 }}>
				Assets
			</Typography>
				<Typography variant="subtitle1" color="text.secondary">
						Every asset in the pool, grouped by type and
						model. Click on an asset to view its details and history.
				</Typography>
			<AssetsTable
				assets={assets}
				statusOptions={statusOptions}
				canEdit={canEdit}
			/>
		</Box>
	);
}
