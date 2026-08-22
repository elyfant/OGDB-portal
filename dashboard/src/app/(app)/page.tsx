import ChampionshipCard from "@/components/ChampionshipCard";
import StatTile from "@/components/StatTile";
import { getMissionsLeaderboard, getMissionsSummary } from "@/lib/api";
import EventIcon from "@mui/icons-material/Event";
import ExploreIcon from "@mui/icons-material/Explore";
import FolderSharedIcon from "@mui/icons-material/FolderShared";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import PlaceIcon from "@mui/icons-material/Place";
import RouteIcon from "@mui/icons-material/Route";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StraightenIcon from "@mui/icons-material/Straighten";
import WavesIcon from "@mui/icons-material/Waves";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";

function formatCount(value: number) {
	return value.toLocaleString("en-GB");
}

export default async function HomePage() {
	const [summary, leaderboard] = await Promise.all([
		getMissionsSummary(),
		getMissionsLeaderboard(),
	]);

	return (
		<Box>
			<Typography variant="h5" sx={{ mb: 6.0 }}>
				Welcome to the OGDB Portal!
			</Typography>

			<Box sx={{ maxWidth: "70%", mx: "auto" }}>
				<Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5 }}>
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

				<Divider sx={{ mt: 5, mb: 3 }}>
					<Typography
						variant="overline"
						sx={{ fontWeight: 600, letterSpacing: 1, color: "primary.main" }}
					>
						NorGliders Championship Board
					</Typography>
				</Divider>

				<Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, mb: 2.5 }}>
					{leaderboard.mostDaysInWater && (
						<ChampionshipCard
							icon={HourglassBottomIcon}
							title="Most days in water"
							winner={leaderboard.mostDaysInWater.glider}
							detail={`${formatCount(leaderboard.mostDaysInWater.days)} days`}
							href={
								leaderboard.mostDaysInWater.gliderAssetId
									? `/gliders/${leaderboard.mostDaysInWater.gliderAssetId}`
									: undefined
							}
							tooltip={`Go to ${leaderboard.mostDaysInWater.glider}'s details page`}
						/>
					)}
					{leaderboard.longestTraveller && (
						<ChampionshipCard
							icon={RouteIcon}
							title="Longest traveller"
							winner={leaderboard.longestTraveller.glider}
							detail={`${formatCount(leaderboard.longestTraveller.distanceKm)} km`}
							href={
								leaderboard.longestTraveller.gliderAssetId
									? `/gliders/${leaderboard.longestTraveller.gliderAssetId}`
									: undefined
							}
							tooltip={`Go to ${leaderboard.longestTraveller.glider}'s details page`}
						/>
					)}
					{leaderboard.mostDives && (
						<ChampionshipCard
							icon={WavesIcon}
							title="Most dives"
							winner={leaderboard.mostDives.glider}
							detail={`${formatCount(leaderboard.mostDives.dives)} dives`}
							href={
								leaderboard.mostDives.gliderAssetId
									? `/gliders/${leaderboard.mostDives.gliderAssetId}`
									: undefined
							}
							tooltip={`Go to ${leaderboard.mostDives.glider}'s details page`}
						/>
					)}
				</Box>

				<Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5 }}>
					{leaderboard.longestDeployment && (
						<ChampionshipCard
							icon={EventIcon}
							title="Longest deployment"
							winner={leaderboard.longestDeployment.glider}
							detail={[
								`Mission: ${leaderboard.longestDeployment.stdMissionName}`,
								`${formatCount(leaderboard.longestDeployment.days)} days`,
							]}
							href={`/missions/${leaderboard.longestDeployment.missionId}`}
							tooltip={`Go to mission ${leaderboard.longestDeployment.stdMissionName}`}
						/>
					)}
					{leaderboard.mostProjectDays && (
						<ChampionshipCard
							icon={FolderSharedIcon}
							title="Most project days"
							winner={leaderboard.mostProjectDays.project}
							detail={`${formatCount(leaderboard.mostProjectDays.days)} days`}
							href="/missions"
							tooltip="Go to missions page"
						/>
					)}
					{leaderboard.mostSiteDays && (
						<ChampionshipCard
							icon={PlaceIcon}
							title="Most site days"
							winner={leaderboard.mostSiteDays.site}
							detail={`${formatCount(leaderboard.mostSiteDays.days)} days`}
							href="/missions"
							tooltip="Go to missions page"
						/>
					)}
				</Box>
			</Box>
		</Box>
	);
}
