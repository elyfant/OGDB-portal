"use client";

import AssetRmaHistoryTable from "@/components/AssetRmaHistoryTable";
import AssetTimelineSection from "@/components/AssetTimelineSection";
import ServicingEventControls, {
	type ServicingEventControlsHandle,
} from "@/components/ServicingEventControls";
import ServicingHistoryTable from "@/components/ServicingHistoryTable";
import { formatDate } from "@/lib/format";
import type { TimelineEvent } from "@/lib/timeline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type {
	AssetRmaSummary,
	LookupOption,
	ServicingEvent,
	ServicingEventTypeOption,
} from "@ogdb/types";
import { useRef } from "react";

// The bare-asset counterpart to GliderTimelineTab's controls+chart+
// Servicing-accordion trio -- a plain asset (a CT sensor, say) has no
// tabs and no Missions/All events/Piloting/Edits sections, but still
// needs somewhere to fix a servicing event after the fact (e.g. a
// forgotten PDF attachment), which is what the Servicing accordion's
// click-to-edit rows are for.
export default function AssetServicingTimeline({
	assetId,
	events,
	servicingEvents,
	rmas,
	eventTypes,
	contacts,
	canEdit,
	decommissionedDate,
	decommissionReason,
}: {
	assetId: number;
	events: TimelineEvent[];
	servicingEvents: ServicingEvent[];
	rmas: AssetRmaSummary[];
	eventTypes: ServicingEventTypeOption[];
	contacts: LookupOption[];
	canEdit: boolean;
	// Read-only display only -- unlike GliderTimelineTab's `lifecycle`,
	// this doesn't unlock a Decommission/Return-to-service action here.
	// A bare asset's decommissioned_date is normally set as a side effect
	// of retiring the glider it was attached to (the "retire with the
	// glider" cascade), not edited on its own page.
	decommissionedDate: string | null;
	decommissionReason: string | null;
}) {
	const controlsRef = useRef<ServicingEventControlsHandle>(null);

	return (
		<Box>
			{decommissionedDate && (
				<Tooltip
					title={decommissionReason ?? ""}
					disableHoverListener={!decommissionReason}
				>
					<Chip
						size="small"
						variant="outlined"
						label={`Retired ${formatDate(decommissionedDate)}`}
						sx={{ mb: 2 }}
					/>
				</Tooltip>
			)}
			<ServicingEventControls
				ref={controlsRef}
				assetId={assetId}
				servicingEvents={servicingEvents}
				eventTypes={eventTypes}
				contacts={contacts}
				canEdit={canEdit}
			/>

			<AssetTimelineSection events={events} />

			<Accordion disableGutters sx={{ mt: 4 }}>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}>
					<Typography color="text.secondary">Servicing</Typography>
				</AccordionSummary>
				<AccordionDetails>
					<ServicingHistoryTable
						events={servicingEvents}
						canEdit={canEdit}
						onEditEvent={(e) => controlsRef.current?.openForEdit(e)}
					/>
				</AccordionDetails>
			</Accordion>

			<Accordion disableGutters sx={{ mt: 2 }}>
				<AccordionSummary expandIcon={<ExpandMoreIcon />}>
					<Typography color="text.secondary">RMA cases</Typography>
				</AccordionSummary>
				<AccordionDetails>
					<AssetRmaHistoryTable rmas={rmas} />
				</AccordionDetails>
			</Accordion>
		</Box>
	);
}
