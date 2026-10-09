import { formatDate } from "@/lib/format";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status-meta";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { AssetStatus, AssetStatusHistoryEntry } from "@ogdb/types";

// Read-only list of every status this asset has been in (asset_status_history),
// newest first. The current status is the top row.
export default function AssetStatusHistoryTable({
	entries,
}: {
	entries: AssetStatusHistoryEntry[];
}) {
	if (entries.length === 0) {
		return (
			<Typography color="text.disabled">No status changes recorded.</Typography>
		);
	}

	return (
		<TableContainer>
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>Date</TableCell>
						<TableCell>Status</TableCell>
						<TableCell>Notes</TableCell>
						<TableCell>Changed by</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{entries.map((e) => {
						const status = e.status as AssetStatus;
						return (
							<TableRow key={e.id}>
								<TableCell>{formatDate(e.effectiveDate)}</TableCell>
								<TableCell>
									<Chip
										size="small"
										label={STATUS_LABEL[status] ?? e.status}
										color={STATUS_COLOR[status] ?? "default"}
									/>
								</TableCell>
								<TableCell>{e.notes ?? "—"}</TableCell>
								<TableCell>{e.changedByEmail ?? "—"}</TableCell>
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
