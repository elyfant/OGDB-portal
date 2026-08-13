import ClickableTableRow from "@/components/ClickableTableRow";
import StatusEditor from "@/components/StatusEditor";
import { getAssets, getStatusOptions } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatUsd } from "@/lib/format";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

// Assets that are gliders live under Fleet's own detail page — the
// asset's id IS the glider's id (gliders are just assets with
// asset_type "glider"), so no separate lookup is needed.
function detailHref(asset: { id: number; assetType: string }) {
	return asset.assetType === "glider"
		? `/gliders/${asset.id}`
		: `/assets/${asset.id}`;
}

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
			<TableContainer component={Paper}>
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>Name</TableCell>
							<TableCell>Serial number</TableCell>
							<TableCell>Asset type</TableCell>
							<TableCell>Asset model</TableCell>
							<TableCell>Purchase date</TableCell>
							<TableCell align="right">Purchase value</TableCell>
							<TableCell>Status</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{assets.map((asset) => (
							<ClickableTableRow key={asset.id} href={detailHref(asset)}>
								<TableCell sx={{ textTransform: "capitalize" }}>
									{asset.name ?? "—"}
								</TableCell>
								<TableCell>{asset.serialNumber ?? "—"}</TableCell>
								<TableCell sx={{ textTransform: "capitalize" }}>
									{asset.assetType.replaceAll("_", " ")}
								</TableCell>
								<TableCell>{asset.assetModel ?? "—"}</TableCell>
								<TableCell>{formatDate(asset.purchaseDate)}</TableCell>
								<TableCell align="right">
									{formatUsd(asset.purchaseValueUsd)}
								</TableCell>
								<TableCell>
									<StatusEditor
										kind="assets"
										id={asset.id}
										statusId={asset.statusId}
										options={statusOptions}
										disabled={!canEdit}
									/>
								</TableCell>
							</ClickableTableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
		</Box>
	);
}
