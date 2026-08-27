import Field from "@/components/Field";
import { formatDate } from "@/lib/format";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { BatteryDetail } from "@ogdb/types";

// Read-only counterpart to CalibrationHistorySection / the Servicing
// accordion, for battery-type assets: the per-instance spec
// (asset_battery_details) up top, then the asset_battery_measurements
// history newest-first. No editing here yet -- there's no
// battery-measurement write endpoint, and the create form seeds the
// first row.
function formatFraction(value: number | null): string {
	if (value === null) return "—";
	// Stored 0–1; a stray out-of-range value is shown raw rather than a
	// misleading ">100%".
	if (value < 0 || value > 1) return String(value);
	return `${Math.round(value * 100)}%`;
}

function formatNumber(value: number | null): string {
	return value === null ? "—" : value.toLocaleString("en-GB");
}

export default function BatteryDetailsSection({
	battery,
}: {
	battery: BatteryDetail;
}) {
	const { measurements } = battery;

	return (
		<Accordion disableGutters sx={{ mt: 2 }}>
			<AccordionSummary expandIcon={<ExpandMoreIcon />}>
				<Typography color="text.secondary">Battery details</Typography>
			</AccordionSummary>
			<AccordionDetails>
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
						gap: 3,
						mb: measurements.length > 0 ? 3 : 0,
					}}
				>
					<Field label="Battery model" value={battery.batteryModel} />
					<Field
						label="Date of manufacture"
						value={formatDate(battery.dateOfManufacture)}
					/>
				</Box>

				<Typography variant="overline" color="text.secondary">
					Measurement history
				</Typography>
				{measurements.length === 0 ? (
					<Typography color="text.disabled">
						No measurements recorded.
					</Typography>
				) : (
					<TableContainer>
						<Table size="small">
							<TableHead>
								<TableRow>
									<TableCell>Date</TableCell>
									<TableCell align="right">Voltage (V)</TableCell>
									<TableCell align="right">Weight (g)</TableCell>
									<TableCell align="right">Remaining capacity</TableCell>
									<TableCell align="right">Age derating</TableCell>
									<TableCell>Notes</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{measurements.map((m) => (
									<TableRow key={m.id}>
										<TableCell>{formatDate(m.measuredDate)}</TableCell>
										<TableCell align="right">
											{formatNumber(m.voltage)}
										</TableCell>
										<TableCell align="right">
											{formatNumber(m.weight)}
										</TableCell>
										<TableCell align="right">
											{formatFraction(m.remainingCapacity)}
										</TableCell>
										<TableCell align="right">
											{formatNumber(m.ageDerating)}
										</TableCell>
										<TableCell>{m.notes ?? "—"}</TableCell>
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
