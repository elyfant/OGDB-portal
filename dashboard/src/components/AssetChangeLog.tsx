import {
	formatDateTime,
	formatFieldName,
	formatFieldValue,
} from "@/lib/format";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { AssetChange } from "@ogdb/types";

const OPERATION_LABEL: Record<string, string> = {
	INSERT: "Created",
	UPDATE: "Updated",
	DELETE: "Deleted",
};

// audit_log.table_name -> what a person would call it.
const TABLE_LABEL: Record<string, string> = {
	assets: "Asset",
	asset_status_history: "Status",
	asset_service_events: "Servicing",
	asset_assignments: "Assignment",
	asset_faults: "Fault",
	documents: "Document",
	asset_battery_measurements: "Battery measurement",
	firmware_history: "Firmware",
	rma_assets: "RMA link",
	asset_sensor_parameters: "Sensor parameter",
};

function tableLabel(tableName: string): string {
	if (TABLE_LABEL[tableName]) return TABLE_LABEL[tableName];
	if (tableName.endsWith("_cal")) return "Calibration";
	if (tableName.endsWith("_details")) return "Details";
	return tableName;
}

// Read-only audit trail for one asset (GET /assets/:id/changes): edits to
// the asset itself, its detail record, and its status, servicing,
// calibration and assignment records. Includes changes made by hand in the
// database (the audit triggers fire for those too). Foreign-key columns
// show as ids.
export default function AssetChangeLog({
	changes,
}: { changes: AssetChange[] }) {
	if (changes.length === 0) {
		return <Typography color="text.disabled">No changes recorded.</Typography>;
	}

	return (
		<TableContainer>
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>When</TableCell>
						<TableCell>What</TableCell>
						<TableCell>Change</TableCell>
						<TableCell>Changed by</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{changes.map((c) => (
						<TableRow key={c.id}>
							<TableCell sx={{ whiteSpace: "nowrap", verticalAlign: "top" }}>
								{formatDateTime(c.changedAt)}
							</TableCell>
							<TableCell sx={{ verticalAlign: "top" }}>
								{tableLabel(c.tableName)}
							</TableCell>
							<TableCell>
								<Typography variant="body2">
									{OPERATION_LABEL[c.operation] ?? c.operation}
								</Typography>
								{c.changes.map((f) => (
									<Typography
										key={f.field}
										variant="body2"
										color="text.secondary"
									>
										{formatFieldName(f.field)}: {formatFieldValue(f.oldValue)} →{" "}
										{formatFieldValue(f.newValue)}
									</Typography>
								))}
							</TableCell>
							<TableCell sx={{ verticalAlign: "top" }}>
								{c.changedByEmail ?? "—"}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
