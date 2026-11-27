import BuildPanel from "@/components/BuildPanel";
import Field from "@/components/Field";
import GliderDetailTabs from "@/components/GliderDetailTabs";
import GliderFormDialog from "@/components/GliderFormDialog";
import GliderLogMenu, { type WorkshopAction } from "@/components/GliderLogMenu";
import GliderStatusBox from "@/components/GliderStatusBox";
import GliderTimelineTab from "@/components/GliderTimelineTab";
import { NvsValue } from "@/components/NvsLink";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import PlatformIcon from "@/components/PlatformIcon";
import ServicingRequiredChip from "@/components/ServicingRequiredChip";
import SetLocationDialog from "@/components/SetLocationDialog";
import StartWorkshopButton from "@/components/StartWorkshopButton";
import StatTile from "@/components/StatTile";
import WearPanel from "@/components/WearPanel";
import {
	getAgencies,
	getAllAssetWear,
	getAssetRmas,
	getContacts,
	getGlider,
	getGliderBuild,
	getLocations,
	getPlatforms,
	getServicingEventTypes,
	getServicingEvents,
	getServicingRequired,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatCount, formatDate, formatMoney } from "@/lib/format";
import { hasLocation, locationText } from "@/lib/glider-location";
import {
	STATUS_LABEL,
	gliderStateTitle,
	statusChipProps,
} from "@/lib/status-meta";
import BuildIcon from "@mui/icons-material/Build";
import RouteIcon from "@mui/icons-material/Route";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StraightenIcon from "@mui/icons-material/Straighten";
import WavesIcon from "@mui/icons-material/Waves";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { BuildMissionRef, SensorCalRecord } from "@ogdb/types";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

// What a mission is called in running text: its standard name, else the name
// it was entered under, else its number.
function missionLabel(m: BuildMissionRef): string {
	return (
		m.stdMissionName ??
		m.missionName ??
		(m.missionNumber != null
			? `mission #${m.missionNumber}`
			: `mission ${m.id}`)
	);
}

export default async function GliderDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const glider = await getGlider(Number(id));
	if (!glider) notFound();
	const [
		build,
		platforms,
		agencies,
		user,
		servicingEvents,
		rmas,
		eventTypes,
		contacts,
		allWear,
		locations,
		servicingFlags,
	] = await Promise.all([
		getGliderBuild(Number(id)),
		getPlatforms(),
		getAgencies(),
		getCurrentUser(),
		getServicingEvents(glider.id),
		getAssetRmas(glider.id),
		getServicingEventTypes(),
		getContacts(),
		getAllAssetWear(),
		getLocations(),
		getServicingRequired(),
	]);
	const wearByAsset = Object.fromEntries(allWear.map((w) => [w.assetId, w]));
	// Only present for a wear-tracked glider (Seagliders, not Slocums).
	const gliderWear = wearByAsset[glider.id];
	const canEdit = user?.role === "editor" || user?.role === "admin";
	// A place can only be recorded while the location isn't fixed by the
	// state (deployed = at sea, missing = unknown, destroyed = none).
	const canSetLocation =
		glider.locationSource === "recorded" ||
		glider.locationSource === "not_recorded";

	// What the Log menu's "Start workshop" can do -- the same rules as the
	// Build section's own button: an existing workshop/scheduled build is
	// edited rather than duplicated, and a glider still out on a mission has
	// no last flown build to copy yet.
	// The glider's open mission, if any: started, no retrieval date, still
	// "active" (or already marked missing in action). A destroyed / missing
	// event offers to close it.
	const openDeployment = build.deployments.find(
		(d) =>
			d.retrievalDate == null &&
			(d.status === "active" || d.status === "missing in action"),
	);
	const openMission = openDeployment
		? {
				id: openDeployment.id,
				label:
					openDeployment.stdMissionName ??
					`mission #${openDeployment.missionNumber ?? openDeployment.id}`,
				status: openDeployment.status,
			}
		: undefined;

	const workshop: WorkshopAction = build.nextMission
		? {
				kind: "open",
				missionId: build.nextMission.id,
				label:
					build.nextMission.status === "workshop"
						? "Edit workshop build"
						: `Edit build for ${missionLabel(build.nextMission)}`,
			}
		: build.buildMission?.status === "active"
			? {
					kind: "blocked",
					reason: `Unavailable while ${glider.name} is active.`,
				}
			: { kind: "available" };

	// Full calibration history per sensor, for the Current build's science
	// rows to expand into -- sourced from currentBuildComponentDetails (the
	// workshop build while one's in progress, otherwise the last flown
	// build), matching whatever BuildPanel is actually showing below.
	const calibrationHistory: Record<number, SensorCalRecord[]> = {};
	for (const d of build.currentBuildComponentDetails) {
		if (d.calibrations) calibrationHistory[d.assetId] = d.calibrations;
	}

	const platformModel = glider.platform
		? [glider.platform, glider.platformModel].filter(Boolean).join(" ")
		: null;

	return (
		<Box>
			<PageBreadcrumb
				catalogue="Glider fleet"
				catalogueHref="/gliders"
				current={glider.name}
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
				<PlatformIcon platform={glider.platform} width={160} />
				<Box sx={{ flex: 1, minWidth: 220 }}>
					<Box
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 1.5,
							flexWrap: "wrap",
						}}
					>
						<Typography variant="h5" sx={{ textTransform: "capitalize" }}>
							{glider.name}
						</Typography>
						{glider.status && (
							<Tooltip title={gliderStateTitle(glider.status)}>
								<Chip
									label={STATUS_LABEL[glider.status]}
									{...statusChipProps(glider.status)}
									size="small"
								/>
							</Tooltip>
						)}
						{glider.decommissionedDate && (
							<Chip label="Decommissioned" size="small" variant="outlined" />
						)}
						<ServicingRequiredChip
							flag={servicingFlags.find((f) => f.assetId === glider.id)}
							assetLabel={glider.name}
							canEdit={canEdit}
						/>
					</Box>
					<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
						Serial {glider.serialNumber ?? "—"} · WMO {glider.wmo ?? "—"} ·{" "}
						{glider.owner ?? "Owner unknown"}
					</Typography>
					<Typography
						variant="body2"
						color={hasLocation(glider) ? "text.secondary" : "text.disabled"}
					>
						Location: {locationText(glider)}
						{canEdit && canSetLocation && (
							<SetLocationDialog
								assetId={glider.id}
								assetName={glider.name}
								locations={locations}
								currentLocationId={glider.locationId}
								hasCurrent={glider.locationSource === "recorded"}
							/>
						)}
					</Typography>
				</Box>
				{canEdit && (
					<GliderLogMenu
						gliderId={glider.id}
						gliderName={glider.name}
						status={glider.status}
						statusSince={glider.statusSince}
						decommissionedDate={glider.decommissionedDate}
						locationSource={glider.locationSource}
						locationId={glider.locationId}
						servicingEvents={servicingEvents}
						eventTypes={eventTypes}
						contacts={contacts}
						locations={locations}
						workshop={workshop}
						openMission={openMission}
					/>
				)}
			</Paper>

			<GliderDetailTabs
				overview={
					<>
						<Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, mb: 4 }}>
							<StatTile
								label="Missions"
								value={formatCount(build.missionsSummary.totalMissions)}
								icon={RouteIcon}
								colorRole="blue"
							/>
							<StatTile
								label="Days in water"
								value={formatCount(build.missionsSummary.totalDays)}
								icon={ScheduleIcon}
								colorRole="yellow"
							/>
							<StatTile
								label="Total distance (km)"
								value={formatCount(build.missionsSummary.totalDistanceKm)}
								icon={StraightenIcon}
								colorRole="aqua"
							/>
							<StatTile
								label="Total dives"
								value={formatCount(build.missionsSummary.totalDives)}
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
							<Typography variant="h6">About glider</Typography>
							{canEdit && (
								<GliderFormDialog
									mode="edit"
									glider={glider}
									platforms={platforms}
									agencies={agencies}
								/>
							)}
						</Box>
						<Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
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
								<Field label="Serial number" value={glider.serialNumber} />
								<Field label="WMO" value={glider.wmo} />
								<Field
									label="Purchase date"
									value={formatDate(glider.purchaseDate)}
								/>
								<Field
									label="Purchase value"
									value={formatMoney(
										glider.purchaseValue,
										glider.purchaseCurrency,
									)}
								/>
								<Field
									label="Platform Model"
									value={
										<NvsValue
											text={
												<Box
													component="span"
													sx={{ textTransform: "capitalize" }}
												>
													{platformModel ?? "—"}
												</Box>
											}
											uri={glider.platformModelUri}
										/>
									}
								/>
								<Field
									label="Platform Type"
									value={
										<NvsValue
											text={glider.platformCategory ?? "—"}
											uri={glider.platformCategoryUri}
										/>
									}
								/>
								<Field
									label="Manufacturer"
									value={
										<NvsValue
											text={glider.platformManufacturerName ?? "—"}
											uri={glider.platformManufacturerUri}
										/>
									}
								/>
							</Box>
						</Paper>

						<Typography variant="h6" sx={{ mb: 1.5 }}>
							Status
						</Typography>
						<Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
							<GliderStatusBox
								status={glider.status}
								statusSince={glider.statusSince}
								statusSource={glider.statusSource}
								decommissionedDate={glider.decommissionedDate}
								decommissionReason={glider.decommissionReason}
								location={glider.location}
								locationSince={glider.locationSince}
								locationSource={glider.locationSource}
								scheduledMissionId={glider.scheduledMissionId}
								scheduledDate={glider.scheduledDate}
							/>
						</Paper>

						{gliderWear && (
							<>
								<Typography variant="h6" sx={{ mb: 1.5 }}>
									Wear
								</Typography>
								<WearPanel wear={gliderWear} />
							</>
						)}

						<Box
							sx={{
								display: "flex",
								alignItems: "flex-start",
								justifyContent: "space-between",
								gap: 2,
								flexWrap: "wrap",
								mb: 1.5,
							}}
						>
							<Box>
								<Typography variant="h6">
									{build.nextMission
										? "Current build: In progress workshop build"
										: "Current build: Last flown build"}
								</Typography>
								<Typography variant="caption" color="text.secondary">
									{build.nextMission ? (
										<>
											{build.nextMission.status === "workshop" ? (
												"Being prepared in the workshop"
											) : (
												<>
													Being prepared for{" "}
													<MuiLink
														component={Link}
														href={`/missions/${build.nextMission.id}`}
													>
														{missionLabel(build.nextMission)}
													</MuiLink>
												</>
											)}
											. Read-only -- a build is edited on its mission.
										</>
									) : build.buildMission ? (
										<>
											As recorded for{" "}
											<MuiLink
												component={Link}
												href={`/missions/${build.buildMission.id}`}
											>
												{missionLabel(build.buildMission)}
											</MuiLink>
											. Read-only -- a build is edited on its mission.
										</>
									) : (
										"Read-only -- a build is edited on its mission."
									)}
								</Typography>
							</Box>
							{build.nextMission ? (
								<Button
									component={Link}
									href={`/missions/${build.nextMission.id}`}
									variant="outlined"
									size="small"
									startIcon={<BuildIcon fontSize="small" />}
								>
									{build.nextMission.status === "workshop"
										? "Edit workshop build"
										: `Edit build for ${missionLabel(build.nextMission)}`}
								</Button>
							) : build.buildMission?.status === "active" ? (
								// Mirrors the gateway's own guard (GlidersService.createWorkshop)
								// -- still out at sea, so there's no "last flown build" to copy
								// into a workshop yet.
								<Typography variant="caption" color="text.secondary">
									Workshop unavailable while {glider.name} is active
								</Typography>
							) : (
								canEdit && <StartWorkshopButton gliderId={glider.id} />
							)}
						</Box>
						<Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
							<BuildPanel
								mode="current"
								components={build.currentBuildComponents}
								sensors={build.currentSciencePayload}
								asOfDate={new Date().toISOString()}
								platform={glider.platform}
								platformModel={glider.platformModel}
								componentDetails={build.currentBuildComponentDetails}
								calibrationHistory={calibrationHistory}
								wear={wearByAsset}
								emptyMessage={
									build.nextMission
										? "No components recorded in the workshop build yet."
										: build.buildMission
											? `No build is recorded for ${missionLabel(build.buildMission)} yet.`
											: "This glider has not flown with a recorded build. Start a workshop to prepare one."
								}
							/>
						</Paper>
					</>
				}
				timeline={
					<GliderTimelineTab
						assetId={glider.id}
						deployments={build.deployments}
						components={build.components}
						componentDetails={build.componentDetails}
						servicingEvents={servicingEvents}
						rmas={rmas}
						editHistory={build.editHistory}
						eventTypes={eventTypes}
						contacts={contacts}
						canEdit={canEdit}
						lifecycle={{
							decommissionedDate: glider.decommissionedDate,
							name: glider.name,
						}}
						locations={locations}
					/>
				}
			/>
		</Box>
	);
}
