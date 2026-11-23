import { formatDate } from "@/lib/format";
import MuiLink from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { GliderDeployment } from "@ogdb/types";
import NextLink from "next/link";

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
						<TableCell>Observatory</TableCell>
						<TableCell>Deployment date</TableCell>
						<TableCell>Retrieval date</TableCell>
						<TableCell align="right">Dives</TableCell>
						<TableCell align="right">Distance (km)</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{deployments.map((d) => (
						<TableRow key={d.id} hover>
							<TableCell>
								<MuiLink
									component={NextLink}
									href={`/missions/${d.id}`}
									underline="hover"
								>
									{d.stdMissionName ?? d.missionNumber ?? "—"}
								</MuiLink>
							</TableCell>
							<TableCell sx={{ textTransform: "capitalize" }}>
								{d.status ?? "—"}
							</TableCell>
							<TableCell>{d.observatory ?? "—"}</TableCell>
							<TableCell>{formatDate(d.deploymentDate)}</TableCell>
							<TableCell>{formatDate(d.retrievalDate)}</TableCell>
							<TableCell align="right">{d.dives ?? "—"}</TableCell>
							<TableCell align="right">
								{d.distanceKm !== null ? d.distanceKm.toFixed(1) : "—"}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
