import BatteriesTable from "@/components/BatteriesTable";
import BatteryFormDialog from "@/components/BatteryFormDialog";
import {
	getAssetTypes,
	getBatteries,
	getBatteryModels,
	getInstitutes,
	getStatusOptions,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default async function BatteriesPage() {
	const [
		batteries,
		statusOptions,
		assetTypes,
		institutes,
		batteryModels,
		user,
	] = await Promise.all([
		getBatteries(),
		getStatusOptions(),
		getAssetTypes(),
		getInstitutes(),
		getBatteryModels(),
		getCurrentUser(),
	]);
	const canEdit = user?.role === "editor" || user?.role === "admin";
	const batteryAssetTypeId = assetTypes.find((t) => t.name === "battery")?.id;

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
				<Typography variant="h5">Batteries</Typography>
				{canEdit && batteryAssetTypeId != null && (
					<BatteryFormDialog
						batteryAssetTypeId={batteryAssetTypeId}
						institutes={institutes}
						batteryModels={batteryModels}
					/>
				)}
			</Box>
			<Typography variant="subtitle1" color="text.secondary">
				Every battery pack in the pool. Click on a battery to view its details
				and history.
			</Typography>
			<BatteriesTable
				batteries={batteries}
				statusOptions={statusOptions}
				canEdit={canEdit}
			/>
		</Box>
	);
}
