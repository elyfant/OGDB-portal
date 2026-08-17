import { formatAssetType, formatDate } from "@/lib/format";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { GliderSciencePayloadItem, SensorCalRecord } from "@ogdb/types";

function CalibrationTable({ record }: { record: SensorCalRecord }) {
	const entries = Object.entries(record.coefficients).filter(
		([, value]) => value !== null && value !== undefined,
	);
	if (entries.length === 0) {
		return (
			<Typography color="text.disabled" variant="body2">
				No coefficients recorded.
			</Typography>
		);
	}
	return (
		<Table size="small">
			<TableBody>
				{entries.map(([key, value]) => (
					<TableRow key={key}>
						<TableCell
							sx={{ fontFamily: "monospace", color: "text.secondary" }}
						>
							{key}
						</TableCell>
						<TableCell>{String(value)}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

export default function GliderSciencePayload({
	sciencePayload,
}: {
	sciencePayload: GliderSciencePayloadItem[];
}) {
	if (sciencePayload.length === 0) {
		return (
			<Typography color="text.disabled">
				No science sensors currently assigned.
			</Typography>
		);
	}

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
			{sciencePayload.map((sensor) => (
				<Paper key={sensor.assetId} variant="outlined" sx={{ p: 2 }}>
					<Typography variant="subtitle1">
						{formatAssetType(sensor.assetType)} — {sensor.serialNumber ?? "—"}
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
						{sensor.modelLabel ?? "Model not set"}
						{sensor.familyLabel ? ` · ${sensor.familyLabel}` : ""}
					</Typography>

					{sensor.calibrations.length === 0 ? (
						<Typography color="text.disabled" variant="body2">
							No calibration records.
						</Typography>
					) : (
						sensor.calibrations.map((record, i) => (
							<Accordion
								key={`${sensor.assetId}-${record.date ?? i}`}
								disableGutters
							>
								<AccordionSummary expandIcon={<ExpandMoreIcon />}>
									<Typography variant="body2">
										Calibrated {formatDate(record.date)}
										{i === 0 ? " (current)" : ""}
									</Typography>
								</AccordionSummary>
								<AccordionDetails>
									<CalibrationTable record={record} />
								</AccordionDetails>
							</Accordion>
						))
					)}
				</Paper>
			))}
		</Box>
	);
}
