"use client";

import AddServicingEventDialog from "@/components/AddServicingEventDialog";
import { formatDate } from "@/lib/format";
import { KIND_META } from "@/lib/timeline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import LockClockIcon from "@mui/icons-material/LockClock";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import type {
	Location,
	LookupOption,
	ServicingEvent,
	ServicingEventTypeOption,
} from "@ogdb/types";
import { forwardRef, useImperativeHandle, useState } from "react";

export interface ServicingEventControlsHandle {
	openForEdit: (event: ServicingEvent) => void;
}

// The "Add event" button + open-event warning + the dialog itself, as one
// unit -- shared by the glider Timeline tab and the asset detail page.
// Exposes openForEdit via a ref so a caller with its own table of
// servicing events (the glider tab's "Servicing" accordion) can open the
// same dialog from a row's spanner button, without this component needing to know that
// accordion exists.
const ServicingEventControls = forwardRef<
	ServicingEventControlsHandle,
	{
		assetId: number;
		servicingEvents: ServicingEvent[];
		eventTypes: ServicingEventTypeOption[];
		contacts: LookupOption[];
		canEdit: boolean;
		// Gliders only -- unlocks the Decommission / Return to service
		// options in the dialog. Omitted for other asset types.
		lifecycle?: { decommissionedDate: string | null; name: string };
		// Gliders only -- the active places, so closing an event here (it's
		// back) can offer the skippable "Where is it now?" prompt.
		locations?: Location[];
	}
>(function ServicingEventControls(
	{
		assetId,
		servicingEvents,
		eventTypes,
		contacts,
		canEdit,
		lifecycle,
		locations,
	},
	ref,
) {
	// Not a destroyed event: it has no end date by design and is never
	// "closed", so it must not trigger the open-event notice.
	const openEvent =
		servicingEvents.find(
			(e) => e.endDate === null && e.eventType !== "destroyed",
		) ?? null;
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingEvent, setEditingEvent] = useState<ServicingEvent | null>(null);

	useImperativeHandle(ref, () => ({
		openForEdit(event) {
			setEditingEvent(event);
			setDialogOpen(true);
		},
	}));

	if (!canEdit) return null;

	const retired = lifecycle?.decommissionedDate ?? null;
	// A glider logs new events from the Log menu in its header; this keeps
	// only the open-event notice and row editing. Other assets still get the
	// plain "Add event" button.
	const hasLogMenu = lifecycle != null;

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
				{retired && (
					<Chip
						size="small"
						variant="outlined"
						label={`Decommissioned ${formatDate(retired)}`}
						sx={{ mr: "auto" }}
					/>
				)}
				{openEvent && (
					<Alert severity="warning" sx={{ py: 0, fontSize: 12.5, flex: 1 }}>
						Open event (
						{openEvent.title ?? KIND_META[openEvent.eventType].label}, started{" "}
						{formatDate(openEvent.startDate)}) — close it before adding another
						{hasLogMenu ? " (Log menu → Close open event)." : "."}
					</Alert>
				)}
				{!hasLogMenu && (
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
						{openEvent ? "Close open event" : "Add event"}
					</Button>
				)}
			</Box>

			<AddServicingEventDialog
				assetId={assetId}
				open={dialogOpen}
				onClose={() => setDialogOpen(false)}
				eventTypes={eventTypes}
				contacts={contacts}
				initialEvent={editingEvent}
				lifecycle={lifecycle}
				locations={locations}
			/>
		</>
	);
});

export default ServicingEventControls;
