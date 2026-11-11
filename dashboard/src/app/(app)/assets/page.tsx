import AssetFormDialog from "@/components/AssetFormDialog";
import AssetsTable from "@/components/AssetsTable";
import {
	getAgencies,
	getAssetTypes,
	getAssets,
	getSensorModels,
	getStatusOptions,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default async function AssetsPage() {
	const [assets, statusOptions, assetTypes, agencies, sensorModels, user] =
		await Promise.all([
			getAssets(),
			getStatusOptions(),
			getAssetTypes(),
			getAgencies(),
			getSensorModels(),
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
				<Typography variant="h5">Assets</Typography>
				{canEdit && (
					<AssetFormDialog
						mode="create"
						assetTypes={assetTypes}
						agencies={agencies}
						sensorModels={sensorModels}
					/>
				)}
			</Box>
			<Typography variant="subtitle1" color="text.secondary">
				Every asset in the pool, grouped by type and model. Click on an asset to
				view its details and history.
			</Typography>
			<AssetsTable
				assets={assets}
				statusOptions={statusOptions}
				canEdit={canEdit}
			/>
		</Box>
	);
}
