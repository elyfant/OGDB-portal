import ChampionshipCard from "@/components/ChampionshipCard";
import EventIcon from "@mui/icons-material/Event";
import FolderSharedIcon from "@mui/icons-material/FolderShared";
import HourglassBottomIcon from "@mui/icons-material/HourglassBottom";
import PlaceIcon from "@mui/icons-material/Place";
import RouteIcon from "@mui/icons-material/Route";
import WavesIcon from "@mui/icons-material/Waves";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import type { MissionsLeaderboard } from "@ogdb/types";

function formatCount(value: number) {
	return value.toLocaleString("en-GB");
}

// Fleet records, shown as two rows of cards. Rendered on the Mission stats
// page; the caller controls the width so the board lines up with the plots.
export default function ChampionshipBoard({
	leaderboard,
}: {
	leaderboard: MissionsLeaderboard;
}) {
	return (
		<Box>
			<Divider sx={{ mb: 3 }}>
				<Typography
					variant="overline"
					sx={{ fontWeight: 600, letterSpacing: 1, color: "primary.main" }}
				>
					Championship Board
				</Typography>
			</Divider>

			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2 }}>
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

			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
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
				{leaderboard.mostObservatoryDays && (
					<ChampionshipCard
						icon={PlaceIcon}
						title="Most observatory days"
						winner={leaderboard.mostObservatoryDays.observatory}
						detail={`${formatCount(leaderboard.mostObservatoryDays.days)} days`}
						href="/missions"
						tooltip="Go to missions page"
					/>
				)}
			</Box>
		</Box>
	);
}
