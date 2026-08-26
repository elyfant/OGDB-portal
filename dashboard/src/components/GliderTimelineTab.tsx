"use client";

import AssetTimelineSection from "@/components/AssetTimelineSection";
import GliderDeploymentHistory from "@/components/GliderDeploymentHistory";
import GliderEditHistory from "@/components/GliderEditHistory";
import ServicingEventControls, {
	type ServicingEventControlsHandle,
} from "@/components/ServicingEventControls";
import { formatAssetType, formatDate } from "@/lib/format";
import { KIND_META, type TimelineEvent } from "@/lib/timeline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type {
	GliderBuildComponent,
	GliderComponentDetail,
	GliderDeployment,
	GliderEditHistoryItem,
	LookupOption,
	ServicingEvent,
	ServicingEventTypeOption,
} from "@ogdb/types";
import { useMemo, useRef } from "react";

function buildTimelineEvents(
	deployments: GliderDeployment[],
	components: GliderBuildComponent[],
	componentDetails: GliderComponentDetail[],
	servicingEvents: ServicingEvent[],
): TimelineEvent[] {
	const events: TimelineEvent[] = [];

	for (const d of deployments) {
		if (!d.launchDate) continue;
		events.push({
			id: `mission-${d.id}`,
			kind: "mission",
			label: d.stdMissionName ?? `Mission ${d.missionNumber ?? d.id}`,
			detail: [d.site, d.dives ? `${d.dives} dives` : null]
				.filter(Boolean)
				.join(" · "),
			startDate: d.launchDate,
			endDate: d.recoveryDate,
			instant: false,
			href: `/missions/${d.id}`,
		});
	}

	const componentsById = new Map(components.map((c) => [c.assetId, c]));
	for (const detail of componentDetails) {
		if (!detail.calibrations) continue;
		const component = componentsById.get(detail.assetId);
		for (const [i, cal] of detail.calibrations.entries()) {
			if (!cal.date) continue;
			events.push({
				id: `cal-${detail.assetId}-${i}`,
				kind: "calibration",
				label: component
					? `${formatAssetType(component.assetType)} calibration`
					: "Calibration",
				detail: component?.serialNumber ? `SN ${component.serialNumber}` : "",
				startDate: cal.date,
				endDate: null,
				instant: true,
			});
		}
	}

	for (const e of servicingEvents) {
		events.push({
			id: `servicing-${e.id}`,
			kind: e.eventType,
			label: e.title ?? KIND_META[e.eventType].label,
			detail: e.performedByName ?? "",
			startDate: e.startDate,
			endDate: e.endDate,
			instant: false,
		});
	}

	return events;
}

export default function GliderTimelineTab({
	assetId,
	deployments,
	components,
	componentDetails,
	servicingEvents,
	editHistory,
	eventTypes,
	contacts,
	canEdit,
}: {
	assetId: number;
	deployments: GliderDeployment[];
	components: GliderBuildComponent[];
	componentDetails: GliderComponentDetail[];
	servicingEvents: ServicingEvent[];
	editHistory: GliderEditHistoryItem[];
	eventTypes: ServicingEventTypeOption[];
	contacts: LookupOption[];
	canEdit: boolean;
}) {
	const allEvents = useMemo(
		() =>
			buildTimelineEvents(
				deployments,
				components,
				componentDetails,
				servicingEvents,
			),
		[deployments, components, componentDetails, servicingEvents],
	);

	const servicingOnly = servicingEvents.filter(
		(e) => e.eventType === "servicing" || e.eventType === "factory_repair",
	);
	const controlsRef = useRef<ServicingEventControlsHandle>(null);

	// All events, newest first -- same convention as every other history
	// table in this app (GliderEditHistory, the calibration catalogue),
	// unlike the chart above which reads oldest-to-newest top-to-bottom.
	const allEventsRows = [...allEvents].sort(
		(a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
	);

	return (
		<Box>
			<ServicingEventControls
				ref={controlsRef}
				assetId={assetId}
				servicingEvents={servicingEvents}
				eventTypes={eventTypes}
				contacts={contacts}
				canEdit={canEdit}
			/>

			<AssetTimelineSection events={allEvents} />

			<Typography variant="h6" sx={{ mt: 4, mb: 1.5 }}>
				History
			</Typography>

			<Accordion disableGutters>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}>
					<Typography color="text.secondary">Missions</Typography>
				</AccordionSummary>
				<AccordionDetails>
					<GliderDeploymentHistory deployments={deployments} />
				</AccordionDetails>
			</Accordion>

			<Accordion disableGutters>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}>
					<Typography color="text.secondary">All events</Typography>
				</AccordionSummary>
				<AccordionDetails>
					{allEventsRows.length === 0 ? (
						<Typography color="text.disabled">No events recorded.</Typography>
					) : (
						<TableContainer>
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell>Type</TableCell>
										<TableCell>Description</TableCell>
										<TableCell>Date</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{allEventsRows.map((e) => {
										const meta = KIND_META[e.kind];
										return (
											<TableRow key={e.id}>
												<TableCell>
													<Chip
														size="small"
														label={meta.label}
														sx={{
															backgroundColor: meta.fill,
															color: meta.color,
															fontWeight: 600,
														}}
													/>
												</TableCell>
												<TableCell>
													{e.label}
													{e.detail && (
														<Typography
															component="span"
															variant="body2"
															color="text.secondary"
														>
															{" "}
															· {e.detail}
														</Typography>
													)}
												</TableCell>
												<TableCell>
													{e.instant
														? formatDate(e.startDate)
														: `${formatDate(e.startDate)} – ${
																e.endDate ? formatDate(e.endDate) : "ongoing"
															}`}
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</TableContainer>
					)}
				</AccordionDetails>
			</Accordion>

			<Accordion disableGutters>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}>
					<Typography color="text.secondary">Servicing</Typography>
				</AccordionSummary>
				<AccordionDetails>
					{servicingOnly.length === 0 ? (
						<Typography color="text.disabled">
							No factory or in-house servicing recorded.
						</Typography>
					) : (
						<TableContainer>
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell>Type</TableCell>
										<TableCell>Title</TableCell>
										<TableCell>Person</TableCell>
										<TableCell>Start</TableCell>
										<TableCell>End</TableCell>
										<TableCell>Document</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{servicingOnly.map((e) => {
										const meta = KIND_META[e.eventType];
										return (
											<TableRow
												key={e.id}
												hover
												onClick={
													canEdit
														? () => controlsRef.current?.openForEdit(e)
														: undefined
												}
												sx={canEdit ? { cursor: "pointer" } : undefined}
											>
												<TableCell>
													<Chip
														size="small"
														label={meta.label}
														sx={{
															backgroundColor: meta.fill,
															color: meta.color,
															fontWeight: 600,
														}}
													/>
												</TableCell>
												<TableCell>{e.title ?? "—"}</TableCell>
												<TableCell>{e.performedByName ?? "—"}</TableCell>
												<TableCell>{formatDate(e.startDate)}</TableCell>
												<TableCell>
													{e.endDate ? (
														formatDate(e.endDate)
													) : (
														<Chip size="small" label="Open" color="warning" />
													)}
												</TableCell>
												<TableCell>
													{e.documentId ? (
														<MuiLink
															href={`/api/documents/${e.documentId}/file`}
															target="_blank"
															rel="noreferrer"
															onClick={(evt) => evt.stopPropagation()}
															sx={{
																display: "inline-flex",
																alignItems: "center",
																gap: 0.5,
																fontSize: 12.5,
															}}
														>
															<OpenInNewIcon sx={{ fontSize: 14 }} />
															PDF
														</MuiLink>
													) : (
														"—"
													)}
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</TableContainer>
					)}
				</AccordionDetails>
			</Accordion>

			<Accordion disableGutters>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}>
					<Typography color="text.secondary">Piloting</Typography>
				</AccordionSummary>
				<AccordionDetails>
					<Typography color="text.disabled">
						Coming soon — piloting logs aren't wired up to OGDB yet.
					</Typography>
				</AccordionDetails>
			</Accordion>

			<Accordion disableGutters>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}>
					<Typography color="text.secondary">Edits</Typography>
				</AccordionSummary>
				<AccordionDetails>
					<GliderEditHistory editHistory={editHistory} />
				</AccordionDetails>
			</Accordion>
		</Box>
	);
}
