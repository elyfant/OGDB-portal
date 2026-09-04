"use client";

import ClickableTableRow from "@/components/ClickableTableRow";
import { formatDate } from "@/lib/format";
import { formatRmaStage } from "@/lib/rma-columns";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { AssetRmaSummary } from "@ogdb/types";

// The RMA counterpart to ServicingHistoryTable/CalibrationHistorySection
// -- thin by design (RMA number, this asset's own reason, status), the
// full shipping/freight sub-timeline only ever shows on the RMA's own
// page. Rows aren't click-to-edit here (unlike Servicing/Calibrations)
// since an RMA isn't edited from an asset's page at all -- they link
// straight through instead, same as GliderDeploymentHistory's rows.
export default function AssetRmaHistoryTable({
	rmas,
}: {
	rmas: AssetRmaSummary[];
}) {
	if (rmas.length === 0) {
		return <Typography color="text.disabled">No RMAs recorded.</Typography>;
	}

	return (
		<TableContainer>
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>RMA #</TableCell>
						<TableCell>Reason</TableCell>
						<TableCell>Opened</TableCell>
						<TableCell>Stage</TableCell>
						<TableCell>Status</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{rmas.map((r) => (
						<ClickableTableRow key={r.rmaId} href={`/rmas/${r.rmaId}`}>
							<TableCell>{r.rmaNumber ?? `RMA ${r.rmaId}`}</TableCell>
							<TableCell>{r.reason}</TableCell>
							<TableCell>{formatDate(r.openedDate)}</TableCell>
							<TableCell>{formatRmaStage(r.currentStage)}</TableCell>
							<TableCell>
								<Chip
									size="small"
									label={r.open ? "Open" : "Closed"}
									color={r.open ? "warning" : "success"}
								/>
							</TableCell>
						</ClickableTableRow>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
