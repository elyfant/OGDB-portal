import AssetFormDialog from "@/components/AssetFormDialog";
import AssetsTable from "@/components/AssetsTable";
import { getAssetTypes, getAssets, getStatusOptions } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default async function AssetsPage() {
	const [assets, statusOptions, assetTypes, user] = await Promise.all([
		getAssets(),
		getStatusOptions(),
		getAssetTypes(),
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
				{canEdit && <AssetFormDialog mode="create" assetTypes={assetTypes} />}
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
