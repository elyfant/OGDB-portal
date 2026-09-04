"use client";

import MuiLink from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { RmaAsset } from "@ogdb/types";
import Link from "next/link";

// Gliders are assets too, but live under Fleet's own detail page --
// same distinction AssetsTable's detailHref makes.
function detailHref(a: RmaAsset): string {
	return a.assetType === "glider"
		? `/gliders/${a.assetId}`
		: `/assets/${a.assetId}`;
}

// The linked-assets list on an RMA's own page -- which assets it covers
// and each one's own reason. Row click opens the reason for editing
// (Fiona's own explicit ask: the reason needs to stay correctable after
// the fact), same click-to-edit interaction CalibrationHistorySection's
// rows already use. The serial number itself is a separate link so
// clicking through to the asset's own page doesn't also open the edit
// dialog.
export default function RmaAssetsTable({
	assets,
	canEdit,
	onEditReason,
}: {
	assets: RmaAsset[];
	canEdit: boolean;
	onEditReason: (asset: RmaAsset) => void;
}) {
	if (assets.length === 0) {
		return <Typography color="text.disabled">No assets linked yet.</Typography>;
	}

	return (
		<TableContainer>
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>Asset</TableCell>
						<TableCell>Reason</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{assets.map((a) => (
						<TableRow
							key={a.id}
							hover
							onClick={canEdit ? () => onEditReason(a) : undefined}
							sx={canEdit ? { cursor: "pointer" } : undefined}
						>
							<TableCell>
								<MuiLink
									component={Link}
									href={detailHref(a)}
									onClick={(e) => e.stopPropagation()}
								>
									SN {a.assetSerialNumber ?? "—"}
								</MuiLink>
							</TableCell>
							<TableCell>{a.reason}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
