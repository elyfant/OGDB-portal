import RmaFormDialog from "@/components/RmaFormDialog";
import RmasTable from "@/components/RmasTable";
import { getManufacturers, getRmas } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default async function RmasPage() {
	const [rmas, manufacturers, user] = await Promise.all([
		getRmas(),
		getManufacturers(),
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
				<Typography variant="h5">RMAs</Typography>
				{canEdit && (
					<RmaFormDialog mode="create" manufacturers={manufacturers} />
				)}
			</Box>
			<Typography variant="subtitle1" color="text.secondary">
				Every manufacturer RMA case, its current stage, and the assets it
				covers. Click on an RMA to view its full history.
			</Typography>
			<RmasTable rmas={rmas} />
		</Box>
	);
}
