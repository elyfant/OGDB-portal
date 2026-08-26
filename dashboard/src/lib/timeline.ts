// Plain data/logic shared by the timeline feature -- deliberately NOT
// "use client" (unlike AssetTimelineChart.tsx, which owns only the
// rendering). Next.js treats every export of a "use client" module as
// an opaque client reference, including plain functions/constants, not
// just components -- a Server Component (the asset detail page) that
// called servicingEventToTimelineEvent() directly from
// AssetTimelineChart.tsx crashed production with "Attempted to call
// servicingEventToTimelineEvent() from the server but ... is on the
// client." Anything a Server Component needs to import and actually
// invoke (not just render as JSX) has to live in a plain module like
// this one instead.
import type { ServicingEvent } from "@ogdb/types";

export type TimelineEventKind =
	| "mission"
	| "calibration"
	| "servicing"
	| "factory_repair"
	| "transit";

export interface TimelineEvent {
	id: string;
	kind: TimelineEventKind;
	label: string;
	detail: string;
	startDate: string;
	// Irrelevant when `instant`. null means "still open" for a span.
	endDate: string | null;
	// Calibrations render as a single point in time; everything else
	// (missions, servicing/factory/transit) has a real duration, even if
	// that duration is "started, not finished yet".
	instant: boolean;
	href?: string;
	// documents.id for whatever's attached via documents.service_event_id
	// -- open with GET /documents/:id/file (already serves inline, not
	// as a download; see DocumentsController). Only ever set for
	// servicing/factory_repair/transit events today.
	documentId?: number | null;
}

export const KIND_META: Record<
	TimelineEventKind,
	{ label: string; color: string; fill: string }
> = {
	mission: { label: "Mission", color: "#2e7d32", fill: "rgba(46,125,50,0.10)" },
	calibration: { label: "Calibration", color: "#f9a825", fill: "#fff8e1" },
	servicing: { label: "In-house servicing", color: "#1976d2", fill: "#e3f2fd" },
	factory_repair: {
		label: "Factory servicing",
		color: "#c62828",
		fill: "#ffebee",
	},
	transit: { label: "Transit", color: "#607d8b", fill: "#eceff1" },
};

// Shared by every caller that has a raw ServicingEvent[] to fold into a
// timeline (the glider Timeline tab and the asset detail page both do)
// -- servicing events are already asset-scoped, so nothing here is
// glider- or asset-specific.
export function servicingEventToTimelineEvent(
	e: ServicingEvent,
): TimelineEvent {
	return {
		id: `servicing-${e.id}`,
		kind: e.eventType,
		label: e.title ?? KIND_META[e.eventType].label,
		detail: e.performedByName ?? "",
		startDate: e.startDate,
		endDate: e.endDate,
		instant: false,
		documentId: e.documentId,
	};
}
