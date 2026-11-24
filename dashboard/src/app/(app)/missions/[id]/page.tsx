import BatteriesSection from "@/components/BatteriesSection";
import BuildPanel from "@/components/BuildPanel";
import CopyBuildButton from "@/components/CopyBuildButton";
import DeviceTestsSection from "@/components/DeviceTestsSection";
import EditMissionButton from "@/components/EditMissionButton";
import Field from "@/components/Field";
import FinalPrepSection from "@/components/FinalPrepSection";
import GliderBuildEditor from "@/components/GliderBuildEditor";
import InspectionSection from "@/components/InspectionSection";
import IntakeSection from "@/components/IntakeSection";
import KeyFiles from "@/components/KeyFiles";
import MissionDetailTabs from "@/components/MissionDetailTabs";
import MissionFilesEditor from "@/components/MissionFilesEditor";
import MissionTrackMapLoader from "@/components/MissionTrackMapLoader";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import RefurbLogsheet, {
	type LogsheetSectionDef,
} from "@/components/RefurbLogsheet";
import RefurbishmentSection from "@/components/RefurbishmentSection";
import RegionIcon from "@/components/RegionIcon";
import SensorsSection from "@/components/SensorsSection";
import SoftwareSection from "@/components/SoftwareSection";
import StatTile from "@/components/StatTile";
import TankRunsSection from "@/components/TankRunsSection";
import TestLinksSection from "@/components/TestLinksSection";
import VacuumSection from "@/components/VacuumSection";
import MissionIridiumSection from "@/components/iridium/MissionIridiumSection";
import { observatoryToArea } from "@/components/mission-stats/observatory-areas";
import {
	getAgencies,
	getContacts,
	getCruises,
	getEndingCauses,
	getGlider,
	getGliders,
	getIridiumMission,
	getMission,
	getMissionBuild,
	getMissionFiles,
	getMissionStatuses,
	getMissionTracks,
	getMissions,
	getObservatories,
	getProjects,
	getRefurbBatteries,
	getRefurbDeviceTests,
	getRefurbFinalPrep,
	getRefurbInspection,
	getRefurbIntake,
	getRefurbSensors,
	getRefurbSoftware,
	getRefurbTestLinks,
	getRefurbVacuum,
	getRefurbishment,
	getStatusOptions,
	getTankRuns,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import {
	capitalizeFirst,
	formatCount,
	formatDate,
	statusColor,
} from "@/lib/format";
import { oceanOpsPlatformUrl } from "@/lib/oceanops";
import DatasetIcon from "@mui/icons-material/Dataset";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StraightenIcon from "@mui/icons-material/Straighten";
import WavesIcon from "@mui/icons-material/Waves";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { Cruise } from "@ogdb/types";
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

// Cruise (by name, linked to its page) and the vessel that sailed it, for
// the Deployment / Retrieval boxes. Both come from the cruise record, so
// picking a cruise is all it takes for the vessel to show.
function CruiseVesselFields({ cruise }: { cruise: Cruise | undefined }) {
	return (
		<>
			<Field
				label="Cruise"
				value={
					cruise ? (
						<MuiLink component={Link} href={`/cruises/${cruise.id}`}>
							{cruise.cruiseName}
						</MuiLink>
					) : null
				}
			/>
			<Field label="Vessel" value={cruise?.vessel ?? null} />
		</>
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
		build,
		statusOptions,
		glider,
		allMissions,
		tracks,
		missionFiles,
		gliders,
		missionStatuses,
		endingCauses,
		projects,
		observatories,
		contacts,
		agencies,
		cruises,
		iridium,
		refurbishment,
		user,
	] = await Promise.all([
		// This mission's own build -- never the glider's live state; a
		// mission's build is edited and read on its own.
		getMissionBuild(mission.id),
		getStatusOptions(),
		mission.gliderAssetId ? getGlider(mission.gliderAssetId) : null,
		// The glider's other missions, as sources for "Copy build from".
		getMissions(),
		getMissionTracks(mission.id),
		getMissionFiles(mission.id),
		// For EditMissionButton's MissionFormDialog -- same lookups the
		// missions catalogue's own edit dialog uses.
		getGliders(),
		getMissionStatuses(),
		getEndingCauses(),
		getProjects(),
		getObservatories(),
		getContacts(),
		getAgencies(),
		getCruises(),
		getIridiumMission(mission.id),
		// Seaglider pre-mission refurbishment logsheet (workshop missions).
		getRefurbishment(mission.id),
		getCurrentUser(),
	]);
	const [
		tankRuns,
		refurbBatteries,
		deviceTests,
		vacuum,
		inspection,
		finalPrep,
		software,
		intake,
		testLinks,
		sensors,
	] = refurbishment
		? await Promise.all([
				getTankRuns(mission.id),
				getRefurbBatteries(mission.id),
				getRefurbDeviceTests(mission.id),
				getRefurbVacuum(mission.id),
				getRefurbInspection(mission.id),
				getRefurbFinalPrep(mission.id),
				getRefurbSoftware(mission.id),
				getRefurbIntake(mission.id),
				getRefurbTestLinks(mission.id),
				getRefurbSensors(mission.id),
			])
		: [[], null, null, null, null, null, null, null, null, null];
	const canEdit = user?.role === "editor" || user?.role === "admin";
	// Offered while the glider is being prepared; kept visible afterwards if
	// one exists, so the record stays reachable from its mission.
	const showRefurbishment =
		refurbishment !== null ||
		(mission.platform === "seaglider" && mission.status === "workshop");

	// The logsheet as eleven numbered section cards, in procedure order. Each
	// card's state (done / in progress / not started) comes from the gateway, so
	// the progress bar and the "Cleared to deploy" box cannot disagree.
	let logsheetSections: LogsheetSectionDef[] | null = null;
	if (
		refurbishment &&
		refurbBatteries &&
		deviceTests &&
		vacuum &&
		inspection &&
		finalPrep &&
		software &&
		intake &&
		testLinks &&
		sensors
	) {
		const stateOf = (key: LogsheetSectionDef["key"]) => {
			const found = refurbishment.sections.find((sec) => sec.key === key);
			if (!found) throw new Error(`No state for section ${key}`);
			return found;
		};
		const linksKey = (g: (typeof testLinks)["selftest"]) =>
			`${g.confirmedAt}:${g.links.map((l) => l.id).join("+")}`;
		logsheetSections = [
			{
				key: "intake",
				number: 1,
				title: "Intake",
				subtitle: "Previous mission · Old Argos tag",
				state: stateOf("intake"),
				content: (
					<IntakeSection
						key={`${intake.updatedAt}-${intake.screenshots.map((s) => s.id).join(",")}`}
						missionId={mission.id}
						data={intake}
						canEdit={canEdit}
					/>
				),
			},
			{
				key: "inspections",
				number: 2,
				title: "Inspections",
				subtitle: "External · Open glider and internal",
				state: stateOf("inspections"),
				content: (
					<InspectionSection
						key={inspection.items
							.map((i) => `${i.key}-${i.updatedAt}`)
							.join(",")}
						missionId={mission.id}
						data={inspection}
						canEdit={canEdit}
					/>
				),
			},
			{
				key: "sensors",
				number: 3,
				title: "Sensors",
				subtitle: "Calibration and swaps",
				state: stateOf("sensors"),
				content: (
					<SensorsSection
						key={sensors.sensors
							.map((x) => `${x.assetId}-${x.updatedAt}`)
							.join(",")}
						missionId={mission.id}
						data={sensors}
						canEdit={canEdit}
					/>
				),
			},
			{
				key: "batteries",
				number: 4,
				title: "Batteries",
				subtitle: "Batteries · Fuel gauges and GPS cell",
				state: stateOf("batteries"),
				content: (
					<BatteriesSection
						missionId={mission.id}
						data={refurbBatteries}
						canEdit={canEdit}
						platform={glider?.platform ?? null}
						platformModel={glider?.platformModel ?? null}
					/>
				),
			},
			{
				key: "device_tests",
				number: 5,
				title: "Device tests",
				subtitle: "Altimeter, compass, GPS, pressure and each sensor",
				state: stateOf("device_tests"),
				content: (
					<DeviceTestsSection
						key={deviceTests.devices
							.map((d) => `${d.key}-${d.updatedAt}`)
							.join(",")}
						missionId={mission.id}
						data={deviceTests}
						canEdit={canEdit}
					/>
				),
			},
			{
				key: "vacuum",
				number: 6,
				title: "Close and vacuum",
				subtitle: "Close up · Vacuum and pressure",
				state: stateOf("vacuum"),
				content: (
					<VacuumSection
						key={vacuum.updatedAt ?? "new"}
						missionId={mission.id}
						data={vacuum}
						canEdit={canEdit}
					/>
				),
			},
			{
				key: "tank_test",
				number: 7,
				title: "Tank test and ballast",
				subtitle: "Repeatable runs · Final trim values",
				state: stateOf("tank_test"),
				content: (
					<TankRunsSection
						missionId={mission.id}
						runs={tankRuns}
						canEdit={canEdit}
					/>
				),
			},
			{
				key: "selftest",
				number: 8,
				title: "Selftest",
				subtitle: "Links to each run",
				state: stateOf("selftest"),
				content: (
					<TestLinksSection
						key={linksKey(testLinks.selftest)}
						only="selftest"
						missionId={mission.id}
						data={testLinks}
						canEdit={canEdit}
					/>
				),
			},
			{
				key: "software",
				number: 9,
				title: "Software track",
				subtitle: "Flash card · Cleanup · Sim dives · Mission files",
				badge: "Parallel",
				state: stateOf("software"),
				content: (
					<SoftwareSection
						key={`${software.updatedAt}-${software.cleanups.map((c) => (c.done ? c.doneAt : "-")).join(",")}`}
						missionId={mission.id}
						data={software}
						canEdit={canEdit}
					/>
				),
			},
			{
				key: "field_test",
				number: 10,
				title: "Field test",
				subtitle: "Only if the glider goes out before it is cleared",
				badge: "Optional",
				state: stateOf("field_test"),
				content: (
					<TestLinksSection
						key={linksKey(testLinks.fieldTest)}
						only="field_test"
						missionId={mission.id}
						data={testLinks}
						canEdit={canEdit}
					/>
				),
			},
			{
				key: "final_prep",
				number: 11,
				title: "Final prep",
				subtitle: "Before packing · Argos tag · Packing",
				state: stateOf("final_prep"),
				content: (
					<FinalPrepSection
						key={`${finalPrep.updatedAt}-${finalPrep.screenshots.map((s) => s.id).join(",")}`}
						missionId={mission.id}
						data={finalPrep}
						canEdit={canEdit}
					/>
				),
			},
		];
	}

	const cruiseById = new Map(cruises.map((c) => [c.id, c]));

	const name =
		mission.stdMissionName ?? mission.missionName ?? `Mission ${mission.id}`;
	const title =
		mission.missionNumber != null ? `${mission.missionNumber}. ${name}` : name;

	const platform =
		mission.platform === "slocum" || mission.platform === "seaglider"
			? mission.platform
			: null;
	const deployment =
		mission.deploymentLatitude !== null && mission.deploymentLongitude !== null
			? {
					latitude: mission.deploymentLatitude,
					longitude: mission.deploymentLongitude,
				}
			: null;
	const retrieval =
		mission.retrievalLatitude !== null && mission.retrievalLongitude !== null
			? {
					latitude: mission.retrievalLatitude,
					longitude: mission.retrievalLongitude,
				}
			: null;

	return (
		<Box>
			<Box sx={{ mx: -3, mt: -3, mb: 3, height: "33vh" }}>
				<MissionTrackMapLoader
					tracks={tracks}
					platform={platform}
					deployment={deployment}
					deploymentDate={mission.deploymentDate}
					retrieval={retrieval}
					retrievalDate={mission.retrievalDate}
				/>
			</Box>

			<PageBreadcrumb
				catalogue="Missions"
				catalogueHref="/missions"
				current={name}
				small
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
				<RegionIcon area={observatoryToArea(mission.observatory)} width={72} />
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
						{formatDate(mission.deploymentDate)} –{" "}
						{formatDate(mission.retrievalDate)}
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

			<MissionDetailTabs
				overview={
					<>
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
								endingCauses={endingCauses}
								projects={projects}
								observatories={observatories}
								contacts={contacts}
								agencies={agencies}
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
								<Field
									label="Observatory"
									value={capitalizeFirst(mission.observatory)}
								/>
								<Field
									label="Project"
									value={externalLink(mission.project, mission.projectUrl)}
								/>
								<Field
									label="Primary investigator"
									value={externalLink(mission.piFullName, mission.piWebpage)}
								/>
								<Field
									label="Operations manager"
									value={externalLink(
										mission.operationsManagerFullName,
										mission.operationsManagerWebpage,
									)}
								/>
								<Field
									label="Operating agency"
									value={mission.operatingAgency}
								/>
								<Field label="Funding agency" value={mission.fundingAgency} />
								<Field
									label="Passport ID"
									value={externalLink(
										mission.wigosId,
										oceanOpsPlatformUrl(mission.wigosId),
									)}
								/>
								<Field
									label="Cause of mission end"
									value={mission.endingCause}
								/>
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
										<Box
											sx={{ display: "flex", flexDirection: "column", gap: 2 }}
										>
											<Typography
												variant="overline"
												color="text.secondary"
												sx={{ letterSpacing: 1 }}
											>
												Deployment
											</Typography>
											<Field
												label="Date"
												value={formatDate(mission.deploymentDate)}
											/>
											<Field
												label="Position"
												value={formatPosition(
													mission.deploymentLatitude,
													mission.deploymentLongitude,
												)}
											/>
											<CruiseVesselFields
												cruise={cruiseById.get(
													mission.deploymentCruiseId ?? -1,
												)}
											/>
										</Box>
										<Box
											sx={{ display: "flex", flexDirection: "column", gap: 2 }}
										>
											<Typography
												variant="overline"
												color="text.secondary"
												sx={{ letterSpacing: 1 }}
											>
												Retrieval
											</Typography>
											<Field
												label="Date"
												value={formatDate(mission.retrievalDate)}
											/>
											<Field
												label="Position"
												value={formatPosition(
													mission.retrievalLatitude,
													mission.retrievalLongitude,
												)}
											/>
											<CruiseVesselFields
												cruise={cruiseById.get(mission.retrievalCruiseId ?? -1)}
											/>
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
									<MissionFilesEditor
										missionId={mission.id}
										files={missionFiles}
									/>
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
									gap: 2,
									flexWrap: "wrap",
									mb: 1.5,
								}}
							>
								<Typography variant="h6">Glider build</Typography>
								{mission.gliderAssetId && (
									<Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
										<CopyBuildButton
											missionId={mission.id}
											primary={!build.recorded}
											sources={allMissions
												.filter(
													(m) =>
														m.gliderAssetId === mission.gliderAssetId &&
														m.id !== mission.id,
												)
												.map((m) => ({
													id: m.id,
													label: `${m.stdMissionName ?? m.missionName ?? `Mission ${m.id}`}${m.status ? ` (${m.status})` : ""}`,
												}))}
										/>
										<GliderBuildEditor
											variant="science"
											gliderId={mission.gliderAssetId}
											components={build.components}
											statusOptions={statusOptions}
											missionId={mission.id}
											missionLabel={name}
											platform={glider?.platform ?? null}
											platformModel={glider?.platformModel ?? null}
										/>
										<GliderBuildEditor
											gliderId={mission.gliderAssetId}
											components={build.components}
											statusOptions={statusOptions}
											missionId={mission.id}
											missionLabel={name}
											platform={glider?.platform ?? null}
											platformModel={glider?.platformModel ?? null}
										/>
									</Box>
								)}
							</Box>
							{build.warnings.map((w) => (
								<Alert key={w} severity="warning" sx={{ mb: 1.5 }}>
									{w}
								</Alert>
							))}
							<Paper variant="outlined" sx={{ p: 3 }}>
								<BuildPanel
									mode="mission"
									components={build.components}
									sensors={build.sciencePayload}
									asOfDate={mission.deploymentDate ?? new Date().toISOString()}
									platform={glider?.platform ?? null}
									platformModel={glider?.platformModel ?? null}
									emptyMessage={
										build.recorded
											? "This build has no components."
											: "Build not recorded for this mission."
									}
									calibrationNote={
										mission.deploymentDate
											? undefined
											: "Calibration shown as of today -- this mission has not deployed."
									}
								/>
							</Paper>
						</Box>

						{showRefurbishment && (
							<Box sx={{ mb: 4 }}>
								<Typography variant="h6" sx={{ mb: 1.5 }}>
									Refurbishment logsheet
								</Typography>
								<RefurbishmentSection
									missionId={mission.id}
									refurbishment={refurbishment}
									canEdit={canEdit}
								/>
							</Box>
						)}

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
										<Typography color="text.disabled">
											Not yet available.
										</Typography>
									</AccordionDetails>
								</Accordion>
							))}
						</Box>
					</>
				}
				refurbishment={
					showRefurbishment ? (
						logsheetSections ? (
							<RefurbLogsheet sections={logsheetSections} />
						) : (
							<Paper variant="outlined" sx={{ p: 3 }}>
								<Typography color="text.secondary">
									No refurbishment logsheet has been started. Start it from the
									Overview tab.
								</Typography>
							</Paper>
						)
					) : null
				}
			/>
		</Box>
	);
}
