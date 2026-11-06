import BuildPanel from "@/components/BuildPanel";
import Field from "@/components/Field";
import GliderDetailTabs from "@/components/GliderDetailTabs";
import GliderFormDialog from "@/components/GliderFormDialog";
import GliderStatusBox from "@/components/GliderStatusBox";
import GliderTimelineTab from "@/components/GliderTimelineTab";
import { NvsValue } from "@/components/NvsLink";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import PlatformIcon from "@/components/PlatformIcon";
import StartWorkshopButton from "@/components/StartWorkshopButton";
import StatTile from "@/components/StatTile";
import {
	getAssetRmas,
	getContacts,
	getGlider,
	getGliderBuild,
	getInstitutes,
	getPlatforms,
	getServicingEventTypes,
	getServicingEvents,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatCount, formatDate, formatMoney } from "@/lib/format";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status-meta";
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
		institutes,
		user,
		servicingEvents,
		rmas,
		eventTypes,
		contacts,
	] = await Promise.all([
		getGliderBuild(Number(id)),
		getPlatforms(),
		getInstitutes(),
		getCurrentUser(),
		getServicingEvents(glider.id),
		getAssetRmas(glider.id),
		getServicingEventTypes(),
		getContacts(),
	]);
	const canEdit = user?.role === "editor" || user?.role === "admin";

	// Full calibration history per sensor, for the Current build's science
	// rows to expand into.
	const calibrationHistory: Record<number, SensorCalRecord[]> = {};
	for (const d of build.componentDetails) {
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
							<Chip
								label={STATUS_LABEL[glider.status]}
								color={STATUS_COLOR[glider.status]}
								size="small"
							/>
						)}
						{glider.decommissionedDate && (
							<Chip label="Retired" size="small" variant="outlined" />
						)}
					</Box>
					<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
						Serial {glider.serialNumber ?? "—"} · WMO {glider.wmo ?? "—"} ·{" "}
						{glider.owner ?? "Owner unknown"}
					</Typography>
				</Box>
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
									institutes={institutes}
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
							/>
						</Paper>

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
								<Typography variant="h6">Last flown build</Typography>
								<Typography variant="caption" color="text.secondary">
									{build.buildMission ? (
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
										? "Next mission in workshop"
										: `Next mission: ${missionLabel(build.nextMission)}`}
								</Button>
							) : (
								canEdit && <StartWorkshopButton gliderId={glider.id} />
							)}
						</Box>
						<Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
							<BuildPanel
								mode="current"
								components={build.components}
								sensors={build.sciencePayload}
								asOfDate={new Date().toISOString()}
								platform={glider.platform}
								platformModel={glider.platformModel}
								componentDetails={build.componentDetails}
								calibrationHistory={calibrationHistory}
								emptyMessage={
									build.buildMission
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
					/>
				}
			/>
		</Box>
	);
}
