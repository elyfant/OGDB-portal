"use client";

import ClickableTableRow from "@/components/ClickableTableRow";
import StatusEditor from "@/components/StatusEditor";
import { formatDate, formatUsd } from "@/lib/format";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { Asset, AssetStatusOption } from "@ogdb/types";
import { useState } from "react";

// Assets that are gliders live under Fleet's own detail page — the
// asset's id IS the glider's id (gliders are just assets with
// asset_type "glider"), so no separate lookup is needed.
function detailHref(asset: { id: number; assetType: string }) {
	return asset.assetType === "glider"
		? `/gliders/${asset.id}`
		: `/assets/${asset.id}`;
}

export default function AssetsTable({
	assets,
	statusOptions,
	canEdit,
}: {
	assets: Asset[];
	statusOptions: AssetStatusOption[];
	canEdit: boolean;
}) {
	const [showDecommissioned, setShowDecommissioned] = useState(false);

	const visibleAssets = showDecommissioned
		? assets
		: assets.filter((a) => a.status !== "decommissioned");

	return (
		<Box>
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
						{visibleAssets.map((asset) => (
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
			<Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
				<FormControlLabel
					control={
						<Checkbox
							size="small"
							checked={showDecommissioned}
							onChange={(e) => setShowDecommissioned(e.target.checked)}
						/>
					}
					label="Show decommissioned assets"
				/>
			</Box>
		</Box>
	);
}
