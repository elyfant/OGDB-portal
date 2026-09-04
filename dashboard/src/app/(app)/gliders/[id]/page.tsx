import Field from "@/components/Field";
import GliderBuildEditor from "@/components/GliderBuildEditor";
import GliderCurrentBuild from "@/components/GliderCurrentBuild";
import GliderDetailTabs from "@/components/GliderDetailTabs";
import GliderFormDialog from "@/components/GliderFormDialog";
import GliderStatusBox from "@/components/GliderStatusBox";
import GliderTimelineTab from "@/components/GliderTimelineTab";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import PlatformIcon from "@/components/PlatformIcon";
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
	getStatusOptions,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatCount, formatDate } from "@/lib/format";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status-meta";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RouteIcon from "@mui/icons-material/Route";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StraightenIcon from "@mui/icons-material/Straighten";
import WavesIcon from "@mui/icons-material/Waves";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

// Links a displayed value out to the NVS term it came from — only
// rendered when a real URI exists, never a dead icon.
function NvsValue({ text, uri }: { text: ReactNode; uri: string | null }) {
	return (
		<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
			{text}
			{uri && (
				<MuiLink
					href={uri}
					target="_blank"
					rel="noreferrer"
					sx={{ display: "inline-flex", color: "text.secondary" }}
				>
					<InfoOutlinedIcon sx={{ fontSize: 16 }} />
				</MuiLink>
			)}
		</Box>
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
		statusOptions,
		platforms,
		institutes,
		user,
		servicingEvents,
		rmas,
		eventTypes,
		contacts,
	] = await Promise.all([
		getGliderBuild(Number(id)),
		getStatusOptions(),
		getPlatforms(),
		getInstitutes(),
		getCurrentUser(),
		getServicingEvents(glider.id),
		getAssetRmas(glider.id),
		getServicingEventTypes(),
		getContacts(),
	]);
	const canEdit = user?.role === "editor" || user?.role === "admin";

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
								<Field
									label="Purchase date"
									value={formatDate(glider.purchaseDate)}
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
								alignItems: "center",
								justifyContent: "space-between",
								mb: 1.5,
							}}
						>
							<Typography variant="h6">Current build</Typography>
							<GliderBuildEditor
								gliderId={glider.id}
								components={build.components}
								statusOptions={statusOptions}
							/>
						</Box>
						<Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
							<GliderCurrentBuild
								components={build.components}
								componentDetails={build.componentDetails}
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
