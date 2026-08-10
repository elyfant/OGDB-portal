import ExploreIcon from "@mui/icons-material/Explore";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StraightenIcon from "@mui/icons-material/Straighten";
import WavesIcon from "@mui/icons-material/Waves";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import StatTile from "../components/StatTile";
import { getMissionsSummary } from "../lib/api";

function formatCount(value: number) {
	return value.toLocaleString("en-GB");
}

export default async function HomePage() {
	const summary = await getMissionsSummary();

	return (
		<Box>
			<Typography variant="h5" sx={{ mb: 0.5 }}>
				Welcome to the OGDB Portal
			</Typography>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
				A running tally of the Ocean Glider Facility&apos;s mission record.
			</Typography>

			<Box
				sx={{
					display: "flex",
					flexWrap: "wrap",
					gap: 2.5,
				}}
			>
				<StatTile
					label="Glider missions"
					value={formatCount(summary.totalMissions)}
					icon={ExploreIcon}
					colorRole="blue"
				/>
				<StatTile
					label="Total dives"
					value={formatCount(summary.totalDives)}
					icon={WavesIcon}
					colorRole="orange"
				/>
				<StatTile
					label="Total distance (km)"
					value={formatCount(summary.totalDistanceKm)}
					icon={StraightenIcon}
					colorRole="aqua"
				/>
				<StatTile
					label="Total days in water"
					value={formatCount(summary.totalDays)}
					icon={ScheduleIcon}
					colorRole="yellow"
				/>
			</Box>
		</Box>
	);
}
