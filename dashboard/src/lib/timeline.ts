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
import type { GliderDeployment, ServicingEvent } from "@ogdb/types";

export type TimelineEventKind =
	| "mission"
	| "calibration"
	| "servicing"
	| "factory_repair"
	| "transit"
	| "on_loan"
	| "field_test"
	| "missing"
	| "destroyed";

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
	// as a download; see DocumentsController).
	documentId?: number | null;
	// Long free text (servicing details, a calibration's notes) -- shown
	// only when a card is expanded, unlike `detail` above which is the
	// always-visible one-line subtitle.
	notes?: string | null;
}

// "span" is the solid-fill bar (date upper-left) -- appropriate for an
// event whose duration is the point. "marker" is the calibration
// treatment (circle + a card with a clear/transparent fill and just a
// colored left edge, date upper-right) -- appropriate for an event
// that reads more like a single record than a block of time, even
// when (like factory_repair) it technically has a start/end span;
// `instant` on the event itself is untouched by this and still drives
// the actual date-range text (see timelineDateLabel) and layout math.
export const KIND_META: Record<
	TimelineEventKind,
	{ label: string; color: string; fill: string; cardStyle: "span" | "marker" }
> = {
	mission: {
		label: "Mission",
		color: "#2e7d32",
		fill: "rgba(46,125,50,0.10)",
		cardStyle: "marker",
	},
	calibration: {
		label: "Calibration",
		color: "#f9a825",
		fill: "#fff8e1",
		cardStyle: "marker",
	},
	servicing: {
		label: "In-house servicing",
		color: "#1976d2",
		fill: "rgba(25,118,210,0.12)",
		cardStyle: "marker",
	},
	factory_repair: {
		label: "Factory servicing",
		color: "#c62828",
		fill: "rgba(198,40,40,0.12)",
		cardStyle: "marker",
	},
	transit: {
		label: "Transit",
		color: "#607d8b",
		fill: "rgba(96,125,139,0.12)",
		cardStyle: "marker",
	},
	on_loan: {
		label: "On loan",
		color: "#6a1b9a",
		fill: "rgba(106,27,154,0.12)",
		cardStyle: "marker",
	},
	field_test: {
		label: "Field test",
		color: "#00838f",
		fill: "rgba(0,131,143,0.12)",
		cardStyle: "marker",
	},
	missing: {
		label: "Missing",
		color: "#ff8f00",
		fill: "rgba(255,143,0,0.14)",
		cardStyle: "marker",
	},
	destroyed: {
		label: "Destroyed",
		color: "#37474f",
		fill: "rgba(55,71,79,0.16)",
		cardStyle: "marker",
	},
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
		notes: e.details,
	};
}

// Shared by every caller that has a raw GliderDeployment[] to fold into
// a timeline -- originally only GliderTimelineTab's own inline loop,
// now also the asset detail page's per-asset missions (GET
// /assets/:id/missions). A deployment with no launch date recorded yet
// has nothing to place on the chart, so callers filter the null out.
export function deploymentToTimelineEvent(
	d: GliderDeployment,
): TimelineEvent | null {
	if (!d.launchDate) return null;
	return {
		id: `mission-${d.id}`,
		kind: "mission",
		label: d.stdMissionName ?? `Mission ${d.missionNumber ?? d.id}`,
		detail: [d.site, d.dives ? `${d.dives} dives` : null]
			.filter(Boolean)
			.join(" · "),
		startDate: d.launchDate,
		endDate: d.recoveryDate,
		instant: false,
		href: `/missions/${d.id}`,
	};
}

// "2 Jun 2026" for a single day (instant events, or a span whose start
// and end fall on the same calendar day); "2 Jun 2026 – 5 Jun 2026" for
// a real range; "2 Jun 2026 – ongoing" while a span is still open
// (end date not set yet).
export function timelineDateLabel(
	event: Pick<TimelineEvent, "instant" | "startDate" | "endDate">,
	formatDate: (value: string | null) => string,
): string {
	if (event.instant) return formatDate(event.startDate);
	if (!event.endDate) return `${formatDate(event.startDate)} – ongoing`;
	if (event.endDate === event.startDate) return formatDate(event.startDate);
	return `${formatDate(event.startDate)} – ${formatDate(event.endDate)}`;
}
