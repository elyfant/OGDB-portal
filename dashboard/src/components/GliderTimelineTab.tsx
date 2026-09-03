"use client";

import AssetTimelineSection from "@/components/AssetTimelineSection";
import GliderDeploymentHistory from "@/components/GliderDeploymentHistory";
import GliderEditHistory from "@/components/GliderEditHistory";
import ServicingEventControls, {
	type ServicingEventControlsHandle,
} from "@/components/ServicingEventControls";
import ServicingHistoryTable from "@/components/ServicingHistoryTable";
import { formatAssetType, formatDate } from "@/lib/format";
import {
	KIND_META,
	type TimelineEvent,
	deploymentToTimelineEvent,
	servicingEventToTimelineEvent,
} from "@/lib/timeline";
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
		const event = deploymentToTimelineEvent(d);
		if (event) events.push(event);
	}

	const componentsById = new Map(components.map((c) => [c.assetId, c]));
	for (const detail of componentDetails) {
		if (!detail.calibrations) continue;
		const component = componentsById.get(detail.assetId);
		for (const [i, cal] of detail.calibrations.entries()) {
			if (!cal.date) continue;
			// Only ct_sensor's coefficients bag ever has `note` -- left in
			// there deliberately (see build.helpers.ts) rather than pulled
			// into its own field, so CalibrationHistory's generic
			// coefficient dump elsewhere doesn't lose a row.
			const note = cal.coefficients.note;
			events.push({
				id: `cal-${detail.assetId}-${i}`,
				kind: "calibration",
				label: component
					? `${formatAssetType(component.assetType)} calibration`
					: "Calibration",
				detail: component?.serialNumber ? `SN ${component.serialNumber}` : "",
				notes: typeof note === "string" ? note : undefined,
				documentId: cal.documentId,
				documentName: cal.documentName,
				startDate: cal.date,
				endDate: null,
				instant: true,
			});
		}
	}

	for (const e of servicingEvents) {
		events.push(servicingEventToTimelineEvent(e));
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
	lifecycle,
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
	// Present only for gliders -- enables the "Decommission / Return to
	// service" path in the Add event dialog. Other assets keep the manual
	// status flow and don't pass this.
	lifecycle: { decommissionedDate: string | null; name: string };
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
				lifecycle={lifecycle}
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
										<TableCell>Document</TableCell>
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
												<TableCell>
													{e.documentId ? (
														<MuiLink
															href={`/api/documents/${e.documentId}/file`}
															target="_blank"
															rel="noreferrer"
															sx={{
																display: "inline-flex",
																alignItems: "center",
																gap: 0.5,
																fontSize: 12.5,
															}}
														>
															<OpenInNewIcon sx={{ fontSize: 14 }} />
															{e.documentName ?? "Document"}
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
					<Typography color="text.secondary">Servicing</Typography>
				</AccordionSummary>
				<AccordionDetails>
					<ServicingHistoryTable
						events={servicingOnly}
						canEdit={canEdit}
						onEditEvent={(e) => controlsRef.current?.openForEdit(e)}
					/>
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
