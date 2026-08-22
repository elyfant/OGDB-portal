import ClickableTableRow from "@/components/ClickableTableRow";
import { getCruises } from "@/lib/api";
import { formatDate } from "@/lib/format";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

export default async function CruisesPage() {
	const cruises = await getCruises();

	return (
		<Box>
			<Typography variant="h5" sx={{ mb: 2 }}>
				Cruises
			</Typography>
				<Typography variant="subtitle1" color="text.secondary">
						Every research cruise associated with the fleet, click on a cruise to view its details and history.
				</Typography>
			<TableContainer component={Paper}>
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>Cruise name</TableCell>
							<TableCell>Cruise number</TableCell>
							<TableCell>Vessel</TableCell>
							<TableCell>Institute</TableCell>
							<TableCell>Cruise leader</TableCell>
							<TableCell>Area</TableCell>
							<TableCell>Start date</TableCell>
							<TableCell>Start port</TableCell>
							<TableCell>End date</TableCell>
							<TableCell>End port</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{cruises.map((cruise) => (
							<ClickableTableRow key={cruise.id} href={`/cruises/${cruise.id}`}>
								<TableCell>{cruise.cruiseName}</TableCell>
								<TableCell>{cruise.cruiseNumber ?? "—"}</TableCell>
								<TableCell>{cruise.vessel ?? "—"}</TableCell>
								<TableCell>{cruise.institute ?? "—"}</TableCell>
								<TableCell>{cruise.cruiseLeader ?? "—"}</TableCell>
								<TableCell>{cruise.area ?? "—"}</TableCell>
								<TableCell>{formatDate(cruise.startDate)}</TableCell>
								<TableCell>{cruise.startPort ?? "—"}</TableCell>
								<TableCell>{formatDate(cruise.endDate)}</TableCell>
								<TableCell>{cruise.endPort ?? "—"}</TableCell>
							</ClickableTableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
		</Box>
	);
}
