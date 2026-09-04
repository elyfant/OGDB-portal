"use client";

import { formatDate } from "@/lib/format";
import { formatRmaStage } from "@/lib/rma-columns";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { RmaEvent } from "@ogdb/types";

// The RMA's own rich sub-timeline, rendered as a vertical stack of
// marker cards -- same circle + colored-left-edge visual language as
// AssetTimelineChart's KIND_META marker style, just without that
// component's date-proportional chart positioning (this is a simple
// ordered list, not something meant to compare against other
// timelines). One consistent color throughout -- every step belongs to
// the same case, which already reads as the "rma" kind's red wherever
// it shows up on an asset's own timeline, so there's no need for a
// second color scheme keyed off event_type here.
const ACCENT = "#c62828";
const ACCENT_FILL = "rgba(198,40,40,0.12)";

export default function RmaEventsTimeline({
	events,
	canEdit,
	onEditEvent,
}: {
	events: RmaEvent[];
	canEdit: boolean;
	onEditEvent: (event: RmaEvent) => void;
}) {
	if (events.length === 0) {
		return (
			<Typography color="text.disabled">No events recorded yet.</Typography>
		);
	}

	// Oldest first -- reads top-to-bottom like the case's own story,
	// same convention as AssetTimelineChart's chart (as opposed to the
	// newest-first convention history tables elsewhere in this app use).
	const sorted = [...events].sort(
		(a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime(),
	);

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
			{sorted.map((e) => (
				<Box
					key={e.id}
					sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}
				>
					<Box
						sx={{
							width: 16,
							height: 16,
							mt: "2px",
							borderRadius: "50%",
							border: "2px solid",
							borderColor: ACCENT,
							backgroundColor: ACCENT_FILL,
							flexShrink: 0,
						}}
					/>
					<Box
						onClick={canEdit ? () => onEditEvent(e) : undefined}
						sx={{
							flex: 1,
							minWidth: 0,
							border: "1px solid",
							borderColor: "divider",
							borderLeft: "4px solid",
							borderLeftColor: ACCENT,
							borderRadius: 1.5,
							px: 1.75,
							py: 1,
							cursor: canEdit ? "pointer" : "default",
						}}
					>
						<Box
							sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}
						>
							<Typography variant="body2" sx={{ fontWeight: 700 }}>
								{formatRmaStage(e.eventType)}
							</Typography>
							<Typography
								variant="caption"
								color="text.disabled"
								sx={{ whiteSpace: "nowrap" }}
							>
								{formatDate(e.eventDate)}
							</Typography>
						</Box>
						{(e.facilityName || e.referenceNumber) && (
							<Typography variant="caption" color="text.secondary">
								{[e.facilityName, e.referenceNumber]
									.filter(Boolean)
									.join(" · ")}
							</Typography>
						)}
						{e.notes && (
							<Typography
								variant="body2"
								sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}
							>
								{e.notes}
							</Typography>
						)}
						{e.documentId && (
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
									mt: 0.5,
								}}
							>
								<OpenInNewIcon sx={{ fontSize: 14 }} />
								{e.documentName ?? "Document"}
							</MuiLink>
						)}
					</Box>
				</Box>
			))}
		</Box>
	);
}
