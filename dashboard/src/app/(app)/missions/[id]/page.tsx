import BuildPanel from "@/components/BuildPanel";
import EditMissionButton from "@/components/EditMissionButton";
import Field from "@/components/Field";
import GliderBuildEditor from "@/components/GliderBuildEditor";
import KeyFiles from "@/components/KeyFiles";
import MissionFilesEditor from "@/components/MissionFilesEditor";
import MissionTrackMapLoader from "@/components/MissionTrackMapLoader";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import RegionIcon from "@/components/RegionIcon";
import StatTile from "@/components/StatTile";
import MissionIridiumSection from "@/components/iridium/MissionIridiumSection";
import { siteToArea } from "@/components/mission-stats/site-areas";
import {
	getContacts,
	getCruises,
	getGlider,
	getGliderBuild,
	getGliders,
	getInstitutes,
	getIridiumMission,
	getMission,
	getMissionFiles,
	getMissionSciencePayload,
	getMissionStatuses,
	getMissionStructuralComponents,
	getMissionTracks,
	getProjects,
	getSites,
	getStatusOptions,
} from "@/lib/api";
import {
	capitalizeFirst,
	formatCount,
	formatDate,
	statusColor,
} from "@/lib/format";
import DatasetIcon from "@mui/icons-material/Dataset";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StraightenIcon from "@mui/icons-material/Straighten";
import WavesIcon from "@mui/icons-material/Waves";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";

const PLACEHOLDER_SECTIONS = [
	"Mission information",
	"Project information",
	"Piloting history",
	"Editing history",
];

function formatPosition(lat: number | null, lon: number | null): string {
	if (lat === null || lon === null) return "—";
	const latDir = lat >= 0 ? "N" : "S";
	const lonDir = lon >= 0 ? "E" : "W";
	return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`;
}

// Contacts.webpage / projects.url are free text, so a bare "example.com" would otherwise
// resolve relative to the portal -- default it to https.
function externalLink(name: string | null, webpage: string | null) {
	if (!name) return null;
	if (!webpage) return name;
	const href = /^https?:\/\//i.test(webpage) ? webpage : `https://${webpage}`;
	return (
		<MuiLink href={href} target="_blank" rel="noreferrer">
			{name}
		</MuiLink>
	);
}

export default async function MissionDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const mission = await getMission(Number(id));
	if (!mission) notFound();

	const [
		gliderBuild,
		statusOptions,
		glider,
		sciencePayload,
		structuralComponents,
		tracks,
		missionFiles,
		gliders,
		missionStatuses,
		projects,
		sites,
		contacts,
		institutes,
		cruises,
		iridium,
	] = await Promise.all([
		// Kept live (not date-scoped) -- GliderBuildEditor's replace/remove
		// actions operate on whichever assignment is currently open, not
		// whatever was open as of this mission's date.
		mission.gliderAssetId ? getGliderBuild(mission.gliderAssetId) : null,
		getStatusOptions(),
		mission.gliderAssetId ? getGlider(mission.gliderAssetId) : null,
		getMissionSciencePayload(mission.id),
		getMissionStructuralComponents(mission.id),
		getMissionTracks(mission.id),
		getMissionFiles(mission.id),
		// For EditMissionButton's MissionFormDialog -- same lookups the
		// missions catalogue's own edit dialog uses.
		getGliders(),
		getMissionStatuses(),
		getProjects(),
		getSites(),
		getContacts(),
		getInstitutes(),
		getCruises(),
		getIridiumMission(mission.id),
	]);

	const name =
		mission.stdMissionName ?? mission.missionName ?? `Mission ${mission.id}`;
	const title =
		mission.missionNumber != null ? `${mission.missionNumber}. ${name}` : name;

	const platform =
		mission.platform === "slocum" || mission.platform === "seaglider"
			? mission.platform
			: null;
	const deployment =
		mission.launchLatitude !== null && mission.launchLongitude !== null
			? { latitude: mission.launchLatitude, longitude: mission.launchLongitude }
			: null;
	const recovery =
		mission.recoveryLatitude !== null && mission.recoveryLongitude !== null
			? {
					latitude: mission.recoveryLatitude,
					longitude: mission.recoveryLongitude,
				}
			: null;

	return (
		<Box>
			<Box sx={{ mx: -3, mt: -3, mb: 3, height: "33vh" }}>
				<MissionTrackMapLoader
					tracks={tracks}
					platform={platform}
					deployment={deployment}
					deploymentDate={mission.launchDate}
					recovery={recovery}
					recoveryDate={mission.recoveryDate}
				/>
			</Box>

			<PageBreadcrumb
				catalogue="Missions"
				catalogueHref="/missions"
				current={name}
			/>

			<Paper
				variant="outlined"
				sx={{
					p: 3,
					mb: 3,
					display: "flex",
					alignItems: "center",
					gap: 3,
					flexWrap: "wrap",
				}}
			>
				<RegionIcon area={siteToArea(mission.site)} width={72} />
				<Box sx={{ flex: 1, minWidth: 220 }}>
					<Box
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 1.5,
							flexWrap: "wrap",
						}}
					>
						<Typography variant="h5">{title}</Typography>
						{mission.status && (
							<Chip
								label={mission.status}
								color={statusColor(mission.status)}
								size="small"
							/>
						)}
					</Box>
					<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
						{formatDate(mission.launchDate)} –{" "}
						{formatDate(mission.recoveryDate)}
					</Typography>
				</Box>
				<MuiLink
					component={Link}
					href={`/datasets/${mission.id}`}
					sx={{
						display: "flex",
						alignItems: "center",
						gap: 0.75,
						fontWeight: 500,
					}}
				>
					<DatasetIcon fontSize="small" />
					View data processing status
				</MuiLink>
			</Paper>

			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, mb: 4 }}>
				<StatTile
					label="Days in water"
					value={formatCount(mission.numberOfDays)}
					icon={ScheduleIcon}
					colorRole="yellow"
				/>
				<StatTile
					label="Total distance (km)"
					value={formatCount(mission.distanceKm, 0)}
					icon={StraightenIcon}
					colorRole="aqua"
				/>
				<StatTile
					label="Total dives"
					value={formatCount(mission.dives)}
					icon={WavesIcon}
					colorRole="orange"
				/>
			</Box>

			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					mb: 1.5,
				}}
			>
				<Typography variant="h6">About mission</Typography>
				<EditMissionButton
					mission={mission}
					gliders={gliders}
					missionStatuses={missionStatuses}
					projects={projects}
					sites={sites}
					contacts={contacts}
					institutes={institutes}
					cruises={cruises}
				/>
			</Box>
			<Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: {
							xs: "repeat(2, 1fr)",
							md: "repeat(4, 1fr)",
						},
						gap: 3,
					}}
				>
					<Field
						label="Glider"
						value={
							mission.gliderAssetId && mission.glider ? (
								<MuiLink
									component={Link}
									href={`/gliders/${mission.gliderAssetId}`}
								>
									{mission.glider}
								</MuiLink>
							) : (
								mission.glider
							)
						}
					/>
					<Field
						label="Glider model"
						value={glider?.platformModelFull ?? glider?.platformModel}
					/>
					<Field label="Site" value={capitalizeFirst(mission.site)} />
					<Field
						label="Project"
						value={externalLink(mission.project, mission.projectUrl)}
					/>
					<Field
						label="Primary investigator"
						value={externalLink(mission.piFullName, mission.piWebpage)}
					/>
					<Field
						label="Lead engineer"
						value={externalLink(mission.techFullName, mission.techWebpage)}
					/>
					<Field label="Operating agency" value={mission.operatingAgency} />
					<Field label="Funding agency" value={mission.fundingAgency} />
				</Box>
			</Paper>

			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
					gap: 3,
					mb: 4,
					alignItems: "start",
				}}
			>
				<Box>
					<Typography variant="h6" sx={{ mb: 1.5 }}>
						Deployment
					</Typography>
					<Paper variant="outlined" sx={{ p: 3 }}>
						<Box sx={{ mb: 3 }}>
							<Typography
								variant="caption"
								color="text.secondary"
								display="block"
								sx={{ mb: 0.5 }}
							>
								Status
							</Typography>
							{mission.status ? (
								<Chip
									label={mission.status}
									color={statusColor(mission.status)}
									size="small"
								/>
							) : (
								<Typography color="text.disabled">—</Typography>
							)}
						</Box>
						<Box
							sx={{
								display: "grid",
								gridTemplateColumns: "1fr 1fr",
								gap: 3,
							}}
						>
							<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
								<Typography
									variant="overline"
									color="text.secondary"
									sx={{ letterSpacing: 1 }}
								>
									Deployment
								</Typography>
								<Field label="Date" value={formatDate(mission.launchDate)} />
								<Field
									label="Position"
									value={formatPosition(
										mission.launchLatitude,
										mission.launchLongitude,
									)}
								/>
								<Field
									label="Cruise"
									value={
										mission.launchCruiseId
											? `Cruise #${mission.launchCruiseId}`
											: null
									}
								/>
								<Field label="Vessel" value={null} />
							</Box>
							<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
								<Typography
									variant="overline"
									color="text.secondary"
									sx={{ letterSpacing: 1 }}
								>
									Recovery
								</Typography>
								<Field label="Date" value={formatDate(mission.recoveryDate)} />
								<Field
									label="Position"
									value={formatPosition(
										mission.recoveryLatitude,
										mission.recoveryLongitude,
									)}
								/>
								<Field
									label="Cruise"
									value={
										mission.recoveryCruiseId
											? `Cruise #${mission.recoveryCruiseId}`
											: null
									}
								/>
								<Field label="Vessel" value={null} />
							</Box>
						</Box>
					</Paper>
				</Box>

				<Box>
					<Box
						sx={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							mb: 1.5,
						}}
					>
						<Typography variant="h6">Key files</Typography>
						<MissionFilesEditor missionId={mission.id} files={missionFiles} />
					</Box>
					<Paper variant="outlined" sx={{ p: 2.5 }}>
						<KeyFiles files={missionFiles} />
					</Paper>
				</Box>
			</Box>

			<Box sx={{ mb: 4 }}>
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						mb: 1.5,
					}}
				>
					<Typography variant="h6">Glider build</Typography>
					{mission.gliderAssetId && (
						<Box sx={{ display: "flex", gap: 1 }}>
							<GliderBuildEditor
								variant="science"
								gliderId={mission.gliderAssetId}
								components={gliderBuild?.components ?? []}
								statusOptions={statusOptions}
								missionId={mission.id}
								defaultDate={mission.launchDate?.slice(0, 10)}
							/>
							<GliderBuildEditor
								gliderId={mission.gliderAssetId}
								components={gliderBuild?.components ?? []}
								statusOptions={statusOptions}
								missionId={mission.id}
								defaultDate={mission.launchDate?.slice(0, 10)}
							/>
						</Box>
					)}
				</Box>
				<Paper variant="outlined" sx={{ p: 3 }}>
					<BuildPanel
						mode="mission"
						components={structuralComponents}
						sensors={sciencePayload}
						asOfDate={mission.launchDate ?? new Date().toISOString()}
						showDiagram={glider?.platform === "slocum"}
					/>
				</Paper>
			</Box>

			<Box sx={{ mb: 4 }}>
				<Typography variant="h6" sx={{ mb: 1.5 }}>
					Iridium airtime
				</Typography>
				<MissionIridiumSection detail={iridium} />
			</Box>

			<Box>
				{PLACEHOLDER_SECTIONS.map((title) => (
					<Accordion key={title} disableGutters>
						<AccordionSummary expandIcon={<ExpandMoreIcon />}>
							<Typography color="text.secondary">{title}</Typography>
						</AccordionSummary>
						<AccordionDetails>
							<Typography color="text.disabled">Not yet available.</Typography>
						</AccordionDetails>
					</Accordion>
				))}
			</Box>
		</Box>
	);
}
