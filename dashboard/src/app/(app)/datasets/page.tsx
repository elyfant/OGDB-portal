import ClickableTableRow from "@/components/ClickableTableRow";
import { getDatasetProcessingStatuses } from "@/lib/api";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

function StatusIcon({ done }: { done: boolean }) {
	return done ? (
		<CheckCircleIcon fontSize="small" color="success" />
	) : (
		<CancelIcon fontSize="small" color="error" />
	);
}

export default async function DatasetsPage() {
	const datasets = await getDatasetProcessingStatuses();

	return (
		<Box>
			<Typography variant="h5" sx={{ mb: 2 }}>
				Datasets
			</Typography>
			<TableContainer component={Paper}>
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>Mission</TableCell>
							<TableCell align="center">L0</TableCell>
							<TableCell align="center">L1</TableCell>
							<TableCell align="center">L1 OG1</TableCell>
							<TableCell align="center">L2</TableCell>
							<TableCell align="center">L2 OG1</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{datasets.map((dataset) => (
							<ClickableTableRow
								key={dataset.missionId}
								href={`/missions/${dataset.missionId}`}
							>
								<TableCell>{dataset.missionName}</TableCell>
								<TableCell align="center">
									<StatusIcon done={dataset.l0Status} />
								</TableCell>
								<TableCell align="center">
									<StatusIcon done={dataset.l1Status} />
								</TableCell>
								<TableCell align="center">
									<StatusIcon done={dataset.l1Og1} />
								</TableCell>
								<TableCell align="center">
									<StatusIcon done={dataset.l2Status} />
								</TableCell>
								<TableCell align="center">
									<StatusIcon done={dataset.l2Og1} />
								</TableCell>
							</ClickableTableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
		</Box>
	);
}
