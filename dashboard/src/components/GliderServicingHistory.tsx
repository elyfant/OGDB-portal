import { formatAssetType, formatDate } from "@/lib/format";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status-meta";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { GliderStatusHistoryItem } from "@ogdb/types";

export default function GliderServicingHistory({
	statusHistory,
}: {
	statusHistory: GliderStatusHistoryItem[];
}) {
	if (statusHistory.length === 0) {
		return (
			<Typography color="text.disabled">
				No status updates recorded for this glider's assets.
			</Typography>
		);
	}

	return (
		<TableContainer>
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>Asset</TableCell>
						<TableCell>Serial number</TableCell>
						<TableCell>Status</TableCell>
						<TableCell>Effective date</TableCell>
						<TableCell>Notes</TableCell>
						<TableCell>Changed by</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{statusHistory.map((s) => (
						<TableRow key={s.id}>
							<TableCell>{formatAssetType(s.assetType)}</TableCell>
							<TableCell>{s.serialNumber ?? "—"}</TableCell>
							<TableCell>
								<Chip
									label={STATUS_LABEL[s.status]}
									color={STATUS_COLOR[s.status]}
									size="small"
								/>
							</TableCell>
							<TableCell>{formatDate(s.effectiveDate)}</TableCell>
							<TableCell>{s.notes ?? "—"}</TableCell>
							<TableCell>{s.changedByEmail ?? "—"}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
