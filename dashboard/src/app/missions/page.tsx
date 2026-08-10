import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { Mission } from "@ogdb/types";
import { getMissions } from "../../lib/api";

function rowSx(status: string | null) {
	if (status === "active") {
		return { backgroundColor: "rgba(76, 175, 80, 0.16)" };
	}
	if (status === "scheduled") {
		return { backgroundColor: "rgba(255, 152, 0, 0.16)" };
	}
	return undefined;
}

function formatDate(value: string | null) {
	if (!value) return "—";
	return new Date(value).toLocaleDateString("en-GB", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function formatNumber(value: number | null, digits = 0) {
	if (value === null || value === undefined) return "—";
	return value.toLocaleString("en-GB", {
		maximumFractionDigits: digits,
	});
}

function statusLabel(status: string | null) {
	if (!status) return "—";
	return status.charAt(0).toUpperCase() + status.slice(1);
}

export default async function MissionsPage() {
	const missions = await getMissions();

	return (
		<Box>
			<Typography variant="h5" sx={{ mb: 2 }}>
				Missions
			</Typography>
			<TableContainer component={Paper}>
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>Mission #</TableCell>
							<TableCell>Std. mission name</TableCell>
							<TableCell>Status</TableCell>
							<TableCell>Glider</TableCell>
							<TableCell>Project</TableCell>
							<TableCell>Site</TableCell>
							<TableCell>PI</TableCell>
							<TableCell>Platform</TableCell>
							<TableCell>Funding agency</TableCell>
							<TableCell>Launch date</TableCell>
							<TableCell>Recovery date</TableCell>
							<TableCell align="right">Dives</TableCell>
							<TableCell align="right">Distance (km)</TableCell>
							<TableCell align="right">Days</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{missions.map((mission: Mission, index: number) => (
							<TableRow
								key={mission.missionNumber ?? index}
								hover
								sx={rowSx(mission.status)}
							>
								<TableCell>{mission.missionNumber ?? "—"}</TableCell>
								<TableCell>{mission.stdMissionName ?? "—"}</TableCell>
								<TableCell>{statusLabel(mission.status)}</TableCell>
								<TableCell sx={{ textTransform: "capitalize" }}>
									{mission.glider ?? "—"}
								</TableCell>
								<TableCell>{mission.project ?? "—"}</TableCell>
								<TableCell>{mission.site ?? "—"}</TableCell>
								<TableCell>{mission.pi ?? "—"}</TableCell>
								<TableCell sx={{ textTransform: "capitalize" }}>
									{mission.platform ?? "—"}
								</TableCell>
								<TableCell>{mission.fundingAgency ?? "—"}</TableCell>
								<TableCell>{formatDate(mission.launchDate)}</TableCell>
								<TableCell>{formatDate(mission.recoveryDate)}</TableCell>
								<TableCell align="right">{mission.dives ?? "—"}</TableCell>
								<TableCell align="right">
									{formatNumber(mission.distanceKm, 1)}
								</TableCell>
								<TableCell align="right">
									{formatNumber(mission.numberOfDays)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
		</Box>
	);
}
