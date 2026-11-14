import ClickableTableRow from "@/components/ClickableTableRow";
import PlatformIcon from "@/components/PlatformIcon";
import {
	getAssetRmas,
	getGliders,
	getMissions,
	getRmas,
	getServicingEvents,
} from "@/lib/api";
import { formatDate, statusColor } from "@/lib/format";
import { formatRmaStage } from "@/lib/rma-columns";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status-meta";
import {
	KIND_META,
	type TimelineEvent,
	rmaToTimelineEvent,
	servicingEventToTimelineEvent,
} from "@/lib/timeline";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { AssetStatus, Glider, Mission } from "@ogdb/types";
import Link from "next/link";

// Mission statuses that mean "being prepared, not flying yet".
const PREP_MISSION_STATUSES = ["workshop", "scheduled"];

// Glider statuses that put a glider on the workshop bench even when no
// workshop/scheduled mission has been opened for it.
const WORKSHOP_STATUSES: AssetStatus[] = [
	"in_house_repairs",
	"factory_service",
	"pre_mission_service",
];

function daysSince(date: string | null): number | null {
	if (!date) return null;
	return Math.max(
		0,
		Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000),
	);
}

function missionTitle(m: Mission): string {
	return m.stdMissionName ?? m.missionName ?? `Mission ${m.id}`;
}

function SectionHeading({
	title,
	subtitle,
}: {
	title: string;
	subtitle: string;
}) {
	return (
		<Box sx={{ mb: 1.5 }}>
			<Typography variant="h6">{title}</Typography>
			<Typography variant="caption" color="text.secondary">
				{subtitle}
			</Typography>
		</Box>
	);
}

function EmptyNote({ children }: { children: string }) {
	return (
		<Paper variant="outlined" sx={{ p: 3 }}>
			<Typography color="text.secondary">{children}</Typography>
		</Paper>
	);
}

// The glider's most recent timeline entry: a flown mission, a servicing
// event or an RMA case -- the same sources as the glider's Timeline tab.
// The mission that put it in the workshop is skipped (it's the current
// state, not history).
function lastEventFor(
	missions: Mission[],
	servicing: TimelineEvent[],
	rmas: TimelineEvent[],
): { label: string; kind: string; date: string; ongoing: boolean } | null {
	const events: TimelineEvent[] = [...servicing, ...rmas];
	for (const m of missions) {
		if (PREP_MISSION_STATUSES.includes(m.status ?? "")) continue;
		if (!m.deploymentDate) continue;
		events.push({
			id: `mission-${m.id}`,
			kind: "mission",
			label: missionTitle(m),
			detail: "",
			startDate: m.deploymentDate,
			endDate: m.retrievalDate,
			instant: false,
		});
	}
	if (events.length === 0) return null;
	// Most recently started wins.
	events.sort((a, b) => b.startDate.localeCompare(a.startDate));
	const e = events[0];
	return {
		label: e.label,
		kind: KIND_META[e.kind].label,
		date: e.startDate,
		ongoing: !e.endDate,
	};
}

export default async function HomePage() {
	const [gliders, missions, allRmas] = await Promise.all([
		getGliders(),
		getMissions(),
		getRmas(),
	]);
	const openRmas = allRmas
		.filter((r) => r.open)
		.sort((a, b) => b.openedDate.localeCompare(a.openedDate));

	const gliderById = new Map(gliders.map((g) => [g.id, g]));
	const missionsByGlider = new Map<number, Mission[]>();
	for (const m of missions) {
		if (m.gliderAssetId == null) continue;
		const list = missionsByGlider.get(m.gliderAssetId) ?? [];
		list.push(m);
		missionsByGlider.set(m.gliderAssetId, list);
	}

	const prepMissionFor = (g: Glider): Mission | undefined =>
		(missionsByGlider.get(g.id) ?? []).find((m) =>
			PREP_MISSION_STATUSES.includes(m.status ?? ""),
		);

	const activeGliders = gliders.filter((g) => !g.decommissionedDate);

	// Section 1: a workshop or scheduled mission is open for the glider.
	const inPreparation = activeGliders
		.map((g) => ({ glider: g, mission: prepMissionFor(g) }))
		.filter((x): x is { glider: Glider; mission: Mission } => !!x.mission)
		.sort((a, b) => a.glider.name.localeCompare(b.glider.name));

	// Section 2: every mission currently out at sea.
	const activeMissions = missions
		.filter((m) => m.status === "active")
		.sort((a, b) =>
			(a.deploymentDate ?? "").localeCompare(b.deploymentDate ?? ""),
		);

	// Section 3: everything on the bench -- a glider being prepared for a
	// mission, plus any glider in a service/repair state.
	const workshopGliders = activeGliders
		.filter(
			(g) =>
				prepMissionFor(g) ||
				(g.status != null && WORKSHOP_STATUSES.includes(g.status)),
		)
		.sort((a, b) => a.name.localeCompare(b.name));

	const workshopDetails = await Promise.all(
		workshopGliders.map(async (g) => {
			const [servicing, rmas] = await Promise.all([
				getServicingEvents(g.id),
				getAssetRmas(g.id),
			]);
			const openRma = rmas.find((r) => r.open);
			return {
				glider: g,
				openRma,
				lastEvent: lastEventFor(
					missionsByGlider.get(g.id) ?? [],
					servicing.map(servicingEventToTimelineEvent),
					rmas.map(rmaToTimelineEvent),
				),
			};
		}),
	);

	// No location column exists in OGDB, so this is derived from what is
	// known: a factory service / open RMA means the glider is off site,
	// anything else means it is on the in-house bench.
	function locationFor(g: Glider, openRma?: { rmaNumber: string | null }) {
		if (g.status === "factory_service" || openRma) {
			return openRma?.rmaNumber
				? `At repairer (RMA ${openRma.rmaNumber})`
				: "At repairer / manufacturer";
		}
		return "In-house workshop";
	}

	return (
		<Box>
			<Typography variant="h5" sx={{ mb: 4 }}>
				Welcome to the OGDB Portal!
			</Typography>

			<Box sx={{ display: "flex", flexDirection: "column", gap: 5 }}>
				{/* Section 1 -- gliders being prepared */}
				<Box>
					<SectionHeading
						title="Gliders in the workshop"
						subtitle="Gliders with a workshop or scheduled mission open — being prepared for deployment."
					/>
					{inPreparation.length === 0 ? (
						<EmptyNote>No gliders are in the workshop or scheduled.</EmptyNote>
					) : (
						<Box
							sx={{
								display: "grid",
								gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
								gap: 2.5,
							}}
						>
							{inPreparation.map(({ glider, mission }) => (
								<Paper
									key={glider.id}
									component={Link}
									href={`/missions/${mission.id}`}
									variant="outlined"
									sx={{
										p: 2.5,
										display: "flex",
										flexDirection: "column",
										gap: 1.5,
										textDecoration: "none",
										color: "inherit",
										borderRadius: 3,
										transition: "border-color 0.15s, box-shadow 0.15s",
										"&:hover": { borderColor: "primary.main", boxShadow: 1 },
									}}
								>
									<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
										<PlatformIcon platform={glider.platform} width={110} />
										<Box sx={{ minWidth: 0 }}>
											<Typography
												variant="h6"
												sx={{ textTransform: "capitalize" }}
											>
												{glider.name}
											</Typography>
											<Typography variant="body2" color="text.secondary">
												{[glider.platform, glider.platformModel]
													.filter(Boolean)
													.join(" ")}
											</Typography>
										</Box>
									</Box>
									<Box
										sx={{
											display: "flex",
											gap: 1,
											flexWrap: "wrap",
										}}
									>
										<Chip
											size="small"
											label={mission.status}
											color={statusColor(mission.status)}
											sx={{ textTransform: "capitalize" }}
										/>
										{glider.status && (
											<Chip
												size="small"
												label={STATUS_LABEL[glider.status]}
												color={STATUS_COLOR[glider.status]}
												variant="outlined"
											/>
										)}
									</Box>
									<Typography variant="body2" color="text.secondary">
										{[mission.project, mission.observatory]
											.filter(Boolean)
											.join(" · ") || "No project or observatory set"}
									</Typography>
								</Paper>
							))}
						</Box>
					)}
				</Box>

				{/* Section 2 -- gliders at sea */}
				<Box>
					<SectionHeading
						title="Active gliders"
						subtitle="Missions currently in the water."
					/>
					{activeMissions.length === 0 ? (
						<EmptyNote>No gliders are currently deployed.</EmptyNote>
					) : (
						<TableContainer component={Paper} variant="outlined">
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell>Glider</TableCell>
										<TableCell>Mission</TableCell>
										<TableCell>Project</TableCell>
										<TableCell>Observatory</TableCell>
										<TableCell>Deployed</TableCell>
										<TableCell align="right">Days at sea</TableCell>
										<TableCell>PI</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{activeMissions.map((m) => {
										const glider = m.gliderAssetId
											? gliderById.get(m.gliderAssetId)
											: undefined;
										return (
											<ClickableTableRow key={m.id} href={`/missions/${m.id}`}>
												<TableCell>
													<Box
														sx={{
															display: "flex",
															alignItems: "center",
															gap: 1.5,
														}}
													>
														<PlatformIcon
															platform={glider?.platform ?? m.platform}
															width={56}
														/>
														<Typography
															variant="body2"
															sx={{
																textTransform: "capitalize",
																fontWeight: 600,
															}}
														>
															{m.glider ?? "—"}
														</Typography>
													</Box>
												</TableCell>
												<TableCell>{missionTitle(m)}</TableCell>
												<TableCell>{m.project ?? "—"}</TableCell>
												<TableCell>{m.observatory ?? "—"}</TableCell>
												<TableCell>{formatDate(m.deploymentDate)}</TableCell>
												<TableCell align="right">
													{daysSince(m.deploymentDate) ?? "—"}
												</TableCell>
												<TableCell>{m.piFullName ?? m.pi ?? "—"}</TableCell>
											</ClickableTableRow>
										);
									})}
								</TableBody>
							</Table>
						</TableContainer>
					)}
				</Box>

				{/* Section 3 -- current workshop status */}
				<Box>
					<SectionHeading
						title="Current status"
						subtitle="Every glider on the bench, with where it is and the latest entry on its timeline."
					/>
					{workshopDetails.length === 0 ? (
						<EmptyNote>No gliders are in the workshop.</EmptyNote>
					) : (
						<TableContainer component={Paper} variant="outlined">
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell>Glider</TableCell>
										<TableCell>Status</TableCell>
										<TableCell>Location</TableCell>
										<TableCell>Last event</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{workshopDetails.map(({ glider, openRma, lastEvent }) => (
										<ClickableTableRow
											key={glider.id}
											href={`/gliders/${glider.id}`}
										>
											<TableCell
												sx={{ textTransform: "capitalize", fontWeight: 600 }}
											>
												{glider.name}
											</TableCell>
											<TableCell>
												{glider.status ? (
													<Chip
														size="small"
														label={STATUS_LABEL[glider.status]}
														color={STATUS_COLOR[glider.status]}
													/>
												) : (
													"—"
												)}
											</TableCell>
											<TableCell>{locationFor(glider, openRma)}</TableCell>
											<TableCell>
												{lastEvent ? (
													<>
														<Typography variant="body2">
															{lastEvent.label}
															<Typography
																component="span"
																variant="body2"
																color="text.secondary"
															>
																{" "}
																· {lastEvent.kind}
															</Typography>
														</Typography>
														<Typography
															variant="caption"
															color="text.secondary"
														>
															{formatDate(lastEvent.date)}
															{lastEvent.ongoing ? " – ongoing" : ""}
														</Typography>
													</>
												) : (
													<Typography variant="body2" color="text.disabled">
														Nothing on the timeline yet
													</Typography>
												)}
											</TableCell>
										</ClickableTableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>
					)}
				</Box>

				{/* Section 4 -- open RMAs and orders */}
				<Box>
					<SectionHeading
						title="Open RMAs and orders"
						subtitle="Cases still open with a manufacturer or repairer."
					/>
					{openRmas.length === 0 ? (
						<EmptyNote>No open RMAs or orders.</EmptyNote>
					) : (
						<TableContainer component={Paper} variant="outlined">
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell>Order/RMA #</TableCell>
										<TableCell>Manufacturer</TableCell>
										<TableCell>Opened</TableCell>
										<TableCell>Current stage</TableCell>
										<TableCell>Serial numbers</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{openRmas.map((r) => (
										<ClickableTableRow key={r.id} href={`/orders/${r.id}`}>
											<TableCell sx={{ fontWeight: 600 }}>
												{r.rmaNumber ?? `Case ${r.id}`}
											</TableCell>
											<TableCell>{r.manufacturerName}</TableCell>
											<TableCell>{formatDate(r.openedDate)}</TableCell>
											<TableCell>
												<Chip
													size="small"
													label={formatRmaStage(r.currentStage)}
													color={
														r.currentStage === "shipping_issue"
															? "error"
															: "info"
													}
												/>
											</TableCell>
											<TableCell>{r.assetSerials.join(", ") || "—"}</TableCell>
										</ClickableTableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>
					)}
				</Box>
			</Box>
		</Box>
	);
}
