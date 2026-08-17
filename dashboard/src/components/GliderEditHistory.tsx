import { formatDateTime } from "@/lib/format";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { GliderEditHistoryItem } from "@ogdb/types";

const OPERATION_LABEL: Record<string, string> = {
	INSERT: "Created",
	UPDATE: "Updated",
	DELETE: "Deleted",
};

export default function GliderEditHistory({
	editHistory,
}: {
	editHistory: GliderEditHistoryItem[];
}) {
	if (editHistory.length === 0) {
		return <Typography color="text.disabled">No edits recorded.</Typography>;
	}

	return (
		<TableContainer>
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>Table</TableCell>
						<TableCell>Row</TableCell>
						<TableCell>Change</TableCell>
						<TableCell>Date</TableCell>
						<TableCell>Changed by</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{editHistory.map((e, i) => (
						<TableRow key={`${e.tableName}-${e.rowId}-${e.changedAt}-${i}`}>
							<TableCell sx={{ fontFamily: "monospace" }}>
								{e.tableName}
							</TableCell>
							<TableCell>{e.rowId}</TableCell>
							<TableCell>
								{OPERATION_LABEL[e.operation] ?? e.operation}
							</TableCell>
							<TableCell>{formatDateTime(e.changedAt)}</TableCell>
							<TableCell>{e.changedByEmail ?? "—"}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
