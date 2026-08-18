import ClickableTableRow from "@/components/ClickableTableRow";
import { formatDate } from "@/lib/format";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { GliderDeployment } from "@ogdb/types";

export default function GliderDeploymentHistory({
	deployments,
}: {
	deployments: GliderDeployment[];
}) {
	if (deployments.length === 0) {
		return (
			<Typography color="text.disabled">No deployments recorded.</Typography>
		);
	}

	return (
		<TableContainer>
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>Mission</TableCell>
						<TableCell>Status</TableCell>
						<TableCell>Site</TableCell>
						<TableCell>Launch date</TableCell>
						<TableCell>Recovery date</TableCell>
						<TableCell align="right">Dives</TableCell>
						<TableCell align="right">Distance (km)</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{deployments.map((d) => (
						<ClickableTableRow key={d.id} href={`/missions/${d.id}`}>
							<TableCell>
								{d.stdMissionName ?? d.missionNumber ?? "—"}
							</TableCell>
							<TableCell sx={{ textTransform: "capitalize" }}>
								{d.status ?? "—"}
							</TableCell>
							<TableCell>{d.site ?? "—"}</TableCell>
							<TableCell>{formatDate(d.launchDate)}</TableCell>
							<TableCell>{formatDate(d.recoveryDate)}</TableCell>
							<TableCell align="right">{d.dives ?? "—"}</TableCell>
							<TableCell align="right">
								{d.distanceKm !== null ? d.distanceKm.toFixed(1) : "—"}
							</TableCell>
						</ClickableTableRow>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
