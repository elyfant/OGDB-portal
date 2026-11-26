"use client";

import ResolveServicingDialog from "@/components/ResolveServicingDialog";
import Button from "@mui/material/Button";
import type { ServicingRequired } from "@ogdb/types";
import { useState } from "react";

// "Resolve" for a row of the home page's Servicing required list. Put it in a
// table cell that stops click propagation (the dialog is a React child, so its
// clicks would otherwise bubble to a clickable row and navigate away).
export default function ResolveServicingButton({
	flag,
	assetLabel,
}: {
	flag: ServicingRequired;
	assetLabel: string;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<Button size="small" onClick={() => setOpen(true)}>
				Resolve
			</Button>
			<ResolveServicingDialog
				open={open}
				onClose={() => setOpen(false)}
				assetId={flag.assetId}
				eventId={flag.eventId}
				assetLabel={assetLabel}
				title={flag.title}
				startDate={flag.startDate}
			/>
		</>
	);
}
