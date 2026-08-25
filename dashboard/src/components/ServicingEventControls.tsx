"use client";

import AddServicingEventDialog from "@/components/AddServicingEventDialog";
import { KIND_META } from "@/components/AssetTimelineChart";
import { formatDate } from "@/lib/format";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import LockClockIcon from "@mui/icons-material/LockClock";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type {
	LookupOption,
	ServicingEvent,
	ServicingEventTypeOption,
} from "@ogdb/types";
import { forwardRef, useImperativeHandle, useState } from "react";

export interface ServicingEventControlsHandle {
	openForEdit: (event: ServicingEvent) => void;
}

// The "Add servicing event" button + open-event warning + the dialog
// itself, as one unit -- shared by the glider Timeline tab and the
// asset detail page. Exposes openForEdit via a ref so a caller with its
// own table of servicing events (the glider tab's "Servicing" accordion)
// can open the same dialog on a row click, without this component
// needing to know that accordion exists.
const ServicingEventControls = forwardRef<
	ServicingEventControlsHandle,
	{
		assetId: number;
		servicingEvents: ServicingEvent[];
		eventTypes: ServicingEventTypeOption[];
		contacts: LookupOption[];
		canEdit: boolean;
	}
>(function ServicingEventControls(
	{ assetId, servicingEvents, eventTypes, contacts, canEdit },
	ref,
) {
	const openEvent = servicingEvents.find((e) => e.endDate === null) ?? null;
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingEvent, setEditingEvent] = useState<ServicingEvent | null>(null);

	useImperativeHandle(ref, () => ({
		openForEdit(event) {
			setEditingEvent(event);
			setDialogOpen(true);
		},
	}));

	if (!canEdit) return null;

	return (
		<>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "flex-end",
					gap: 2,
					mb: 2,
				}}
			>
				{openEvent && (
					<Alert severity="warning" sx={{ py: 0, fontSize: 12.5, flex: 1 }}>
						Open event (
						{openEvent.title ?? KIND_META[openEvent.eventType].label}, started{" "}
						{formatDate(openEvent.startDate)}) — close it before adding another.
					</Alert>
				)}
				<Button
					variant="contained"
					size="small"
					startIcon={openEvent ? <LockClockIcon /> : <AddCircleOutlineIcon />}
					onClick={() => {
						setEditingEvent(openEvent);
						setDialogOpen(true);
					}}
					sx={{ whiteSpace: "nowrap" }}
				>
					{openEvent ? "Close open event" : "Add servicing event"}
				</Button>
			</Box>

			<AddServicingEventDialog
				assetId={assetId}
				open={dialogOpen}
				onClose={() => setDialogOpen(false)}
				eventTypes={eventTypes}
				contacts={contacts}
				initialEvent={editingEvent}
			/>
		</>
	);
});

export default ServicingEventControls;
