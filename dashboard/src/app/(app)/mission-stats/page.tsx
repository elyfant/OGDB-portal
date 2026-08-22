import StatTile from "@/components/StatTile";
import MissionStatsCharts from "@/components/mission-stats/MissionStatsCharts";
import { getMissions, getMissionsSummary } from "@/lib/api";
import ExploreIcon from "@mui/icons-material/Explore";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StraightenIcon from "@mui/icons-material/Straighten";
import WavesIcon from "@mui/icons-material/Waves";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

function formatCount(value: number) {
	return value.toLocaleString("en-GB");
}

export default async function MissionStatsPage() {
	const [missions, summary] = await Promise.all([
		getMissions(),
		getMissionsSummary(),
	]);

	return (
		<Box>
			<Typography variant="h5" sx={{ mb: 2 }}>
				Mission Stats
			</Typography>

			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, mb: 4 }}>
				<StatTile
					label="Glider missions"
					value={formatCount(summary.totalMissions)}
					icon={ExploreIcon}
					colorRole="blue"
					href="/missions"
					tooltip="Go to missions"
				/>
				<StatTile
					label="Total dives"
					value={formatCount(summary.totalDives)}
					icon={WavesIcon}
					colorRole="orange"
					href="/missions"
					tooltip="Go to missions"
				/>
				<StatTile
					label="Total distance (km)"
					value={formatCount(summary.totalDistanceKm)}
					icon={StraightenIcon}
					colorRole="aqua"
					href="/missions"
					tooltip="Go to missions"
				/>
				<StatTile
					label="Total days in water"
					value={formatCount(summary.totalDays)}
					icon={ScheduleIcon}
					colorRole="yellow"
					href="/missions"
					tooltip="Go to missions"
				/>
			</Box>

			<MissionStatsCharts missions={missions} />
		</Box>
	);
}
