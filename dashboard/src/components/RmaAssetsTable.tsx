"use client";

import EditRowButton from "@/components/EditRowButton";
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
// and each one's own reason. The reason has to stay correctable after the
// fact, so each row has a spanner button that opens it for editing (same
// control as the other history tables; the row itself isn't clickable). The
// serial number is a link to the asset's own page.
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
						{canEdit && <TableCell sx={{ width: 48 }} />}
					</TableRow>
				</TableHead>
				<TableBody>
					{assets.map((a) => (
						<TableRow key={a.id}>
							<TableCell>
								<MuiLink component={Link} href={detailHref(a)}>
									SN {a.assetSerialNumber ?? "—"}
								</MuiLink>
							</TableCell>
							<TableCell>{a.reason}</TableCell>
							{canEdit && (
								<TableCell align="right">
									<EditRowButton
										label="Edit reason"
										onClick={() => onEditReason(a)}
									/>
								</TableCell>
							)}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
