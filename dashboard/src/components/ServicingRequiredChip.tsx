"use client";

import ResolveServicingDialog from "@/components/ResolveServicingDialog";
import { formatDate } from "@/lib/format";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import type { ServicingRequired } from "@ogdb/types";
import { useState } from "react";

// The red "Servicing required" tag on an asset or glider: it must not be
// deployed until repaired. With `canEdit`, the chip's ✕ resolves it (the
// repair is done): the tag goes away but the event stays on the timeline.
// Without `canEdit` it is read-only (viewers, and the tables, where an
// accidental click on a ✕ would be too easy).
export default function ServicingRequiredChip({
	flag,
	assetLabel,
	canEdit = false,
	size = "small",
}: {
	flag: ServicingRequired | null | undefined;
	assetLabel: string;
	canEdit?: boolean;
	size?: "small" | "medium";
}) {
	const [open, setOpen] = useState(false);
	if (!flag) return null;

	return (
		<>
			<Tooltip
				title={`Do not deploy — flagged ${formatDate(flag.startDate)}${
					flag.title ? `: ${flag.title}` : ""
				}${canEdit ? ". Click ✕ once it's repaired." : ""}`}
			>
				<Chip
					label="Servicing required"
					color="error"
					size={size}
					onDelete={canEdit ? () => setOpen(true) : undefined}
				/>
			</Tooltip>
			{canEdit && (
				<ResolveServicingDialog
					open={open}
					onClose={() => setOpen(false)}
					assetId={flag.assetId}
					eventId={flag.eventId}
					assetLabel={assetLabel}
					title={flag.title}
					startDate={flag.startDate}
				/>
			)}
		</>
	);
}
