import StatusEditor from "@/components/StatusEditor";
import { getAssets, getStatusOptions } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

function formatDate(value: string | null) {
	if (!value) return "—";
	return new Date(value).toLocaleDateString("en-GB", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function formatUsd(value: number | null) {
	if (value === null) return "—";
	return value.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
	});
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
							<TableRow key={asset.id} hover>
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
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
		</Box>
	);
}
