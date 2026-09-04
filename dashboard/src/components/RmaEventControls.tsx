"use client";

import AddRmaEventDialog from "@/components/AddRmaEventDialog";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import type { LookupOption, RmaEvent } from "@ogdb/types";
import { forwardRef, useImperativeHandle, useState } from "react";

export interface RmaEventControlsHandle {
	openForEdit: (event: RmaEvent) => void;
}

// The "Add event" button + the dialog itself, as one unit -- same shape
// as ServicingEventControls, minus the "one open event blocks another"
// warning, since rma_events has no open/close-per-row concept at all
// (every step is instantaneous; the case-level open/closed status is
// derived separately from the latest step's type). Exposes openForEdit
// via a ref so the events timeline can open the same dialog on a row
// click.
const RmaEventControls = forwardRef<
	RmaEventControlsHandle,
	{
		rmaId: number;
		manufacturers: LookupOption[];
		canEdit: boolean;
	}
>(function RmaEventControls({ rmaId, manufacturers, canEdit }, ref) {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingEvent, setEditingEvent] = useState<RmaEvent | null>(null);

	useImperativeHandle(ref, () => ({
		openForEdit(event) {
			setEditingEvent(event);
			setDialogOpen(true);
		},
	}));

	if (!canEdit) return null;

	return (
		<>
			<Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
				<Button
					variant="contained"
					size="small"
					startIcon={<AddCircleOutlineIcon />}
					onClick={() => {
						setEditingEvent(null);
						setDialogOpen(true);
					}}
				>
					Add event
				</Button>
			</Box>

			<AddRmaEventDialog
				rmaId={rmaId}
				open={dialogOpen}
				onClose={() => setDialogOpen(false)}
				manufacturers={manufacturers}
				initialEvent={editingEvent}
			/>
		</>
	);
});

export default RmaEventControls;
