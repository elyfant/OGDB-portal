import { formatDate, formatFieldValue } from "@/lib/format";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { SensorCalRecord } from "@ogdb/types";

function CoefficientTable({ record }: { record: SensorCalRecord }) {
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
						<TableCell>{formatFieldValue(value)}</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

// Renders a component's full calibration history as one accordion per
// date (most recent first, labeled "current"). Shared between Science
// Payload and the Current Build row-expansion panel — same data shape,
// same "all coefficients, not just current" requirement.
export default function CalibrationHistory({
	calibrations,
}: {
	calibrations: SensorCalRecord[];
}) {
	if (calibrations.length === 0) {
		return (
			<Typography color="text.disabled" variant="body2">
				No calibration records.
			</Typography>
		);
	}
	return (
		<>
			{calibrations.map((record, i) => (
				<Accordion key={`${record.date ?? i}`} disableGutters>
					<AccordionSummary expandIcon={<ExpandMoreIcon />}>
						<Typography variant="body2">
							Calibrated {formatDate(record.date)}
							{i === 0 ? " (current)" : ""}
						</Typography>
					</AccordionSummary>
					<AccordionDetails>
						<CoefficientTable record={record} />
					</AccordionDetails>
				</Accordion>
			))}
		</>
	);
}
