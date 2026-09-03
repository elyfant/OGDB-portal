"use client";

import AssetTimelineSection from "@/components/AssetTimelineSection";
import ServicingEventControls, {
	type ServicingEventControlsHandle,
} from "@/components/ServicingEventControls";
import ServicingHistoryTable from "@/components/ServicingHistoryTable";
import type { TimelineEvent } from "@/lib/timeline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type {
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
	eventTypes,
	contacts,
	canEdit,
}: {
	assetId: number;
	events: TimelineEvent[];
	servicingEvents: ServicingEvent[];
	eventTypes: ServicingEventTypeOption[];
	contacts: LookupOption[];
	canEdit: boolean;
}) {
	const controlsRef = useRef<ServicingEventControlsHandle>(null);

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
		</Box>
	);
}
