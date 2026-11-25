import { formatDate } from "@/lib/format";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { ArgosTagMeasurement } from "@ogdb/types";

const dash = (v: number | string | null) =>
	v === null ? "—" : typeof v === "number" ? v.toLocaleString("en-GB") : v;

// The tag's test history (asset_argos_tag_measurements), newest first. Read-only:
// readings are added where the tag is tested, in the refurbishment logsheet.
// The tag's details (type, Argos Dec and Hex, name) are in the generic details
// panel above, like every other asset's.
export default function ArgosTagTestsSection({
	measurements,
}: {
	measurements: ArgosTagMeasurement[];
}) {
	return (
		<Accordion disableGutters sx={{ mb: 3 }}>
			<AccordionSummary expandIcon={<ExpandMoreIcon />}>
				<Typography>
					Argos tag tests{" "}
					<Typography component="span" color="text.secondary">
						({measurements.length})
					</Typography>
				</Typography>
			</AccordionSummary>
			<AccordionDetails>
				{measurements.length === 0 ? (
					<Typography color="text.disabled">
						No tests recorded for this tag yet. They are added from the
						refurbishment logsheet.
					</Typography>
				) : (
					<TableContainer>
						<Table size="small">
							<TableHead>
								<TableRow>
									<TableCell>Date</TableCell>
									<TableCell>Tagware</TableCell>
									<TableCell align="right">Tx attempts</TableCell>
									<TableCell align="right">Tx fails</TableCell>
									<TableCell align="right">Battery (V)</TableCell>
									<TableCell>Transmission test</TableCell>
									<TableCell>Recorded by</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{measurements.map((m) => (
									<TableRow key={m.id}>
										<TableCell>{formatDate(m.measuredDate)}</TableCell>
										<TableCell>{dash(m.tagwareVersion)}</TableCell>
										<TableCell align="right">{dash(m.txAttempts)}</TableCell>
										<TableCell align="right">{dash(m.txFailCount)}</TableCell>
										<TableCell align="right">
											{dash(m.batteryVoltage)}
										</TableCell>
										<TableCell>
											{m.transmissionTestPassed === null ? (
												"—"
											) : (
												<Chip
													size="small"
													color={m.transmissionTestPassed ? "success" : "error"}
													label={m.transmissionTestPassed ? "Pass" : "Fail"}
												/>
											)}
										</TableCell>
										<TableCell>{dash(m.changedByName)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
				)}
			</AccordionDetails>
		</Accordion>
	);
}
