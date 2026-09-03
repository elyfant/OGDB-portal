"use client";

import { formatDate } from "@/lib/format";
import {
	KIND_META,
	type TimelineEvent,
	timelineDateLabel,
} from "@/lib/timeline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

// Year-label column, then the dashed spine, then a gap before card
// content starts -- kept as explicit numbers rather than container
// padding, since an absolutely-positioned child's left/right offsets
// are measured from the padding EDGE (i.e. they ignore the parent's
// own padding entirely). Relying on `pl`/`pr` on the container here is
// exactly what caused every card to render at x:0, underneath the year
// labels and spine, instead of to their right.
const AXIS_YEAR_WIDTH = 110;
const AXIS_LINE_X = 130;
const CONTENT_LEFT = 160;
const CONTENT_RIGHT = 24;

const PX_PER_DAY = 0.6;
const MIN_SPAN_HEIGHT = 56;
const MIN_MARKER_HEIGHT = 40;
// A generous, fixed reservation for an expanded card's notes -- bounded
// on purpose (the notes box itself scrolls past a max-height) so one
// very long note can never throw off every card below it.
const EXPANDED_EXTRA_HEIGHT = 150;
const GAP = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function endOrToday(e: TimelineEvent, todayIso: string): string {
	if (e.instant) return e.startDate;
	return e.endDate ?? todayIso;
}

// Proportional-to-real-time positions, then a top-down sweep that pushes
// anything too close to its predecessor further down -- keeps events in
// chronological order and roughly where their date implies, without
// dense clusters (e.g. several calibrations in the same month)
// collapsing into an unreadable stack. expandedIds feeds back in here
// (not just into rendering) so an expanded card's extra height actually
// pushes every later card down instead of overlapping it.
function layout(events: TimelineEvent[], expandedIds: Set<string>) {
	const todayIso = new Date().toISOString().slice(0, 10);
	if (events.length === 0) {
		return {
			rows: [],
			years: [] as { year: number; top: number }[],
			height: 0,
		};
	}

	const starts = events.map((e) => new Date(e.startDate).getTime());
	const ends = events.map((e) => new Date(endOrToday(e, todayIso)).getTime());
	const minTime = Math.min(...starts);
	const maxTime = Math.max(...ends, minTime + DAY_MS);

	const toY = (t: number) => ((t - minTime) / DAY_MS) * PX_PER_DAY;

	const sorted = [...events].sort(
		(a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
	);

	let cursor = 0;
	const rows = sorted.map((e) => {
		const rawTop = toY(new Date(e.startDate).getTime());
		// Sized off cardStyle, not `instant` -- a "marker"-style event
		// (calibration, or factory_repair matching it) always gets the
		// compact fixed height, even when it technically has a real
		// start/end span (its date range still shows correctly in the
		// header text; it just doesn't grow a tall bar for it).
		let rawHeight =
			KIND_META[e.kind].cardStyle === "marker"
				? MIN_MARKER_HEIGHT
				: Math.max(
						MIN_SPAN_HEIGHT,
						toY(new Date(endOrToday(e, todayIso)).getTime()) - rawTop,
					);
		if (expandedIds.has(e.id) && e.notes?.trim()) {
			rawHeight += EXPANDED_EXTRA_HEIGHT;
		}
		const top = Math.max(rawTop, cursor);
		cursor = top + rawHeight + GAP;
		return { event: e, top, height: rawHeight };
	});

	const minYear = new Date(minTime).getFullYear();
	const maxYear = new Date(maxTime).getFullYear();
	const years = [];
	for (let y = minYear; y <= maxYear; y++) {
		years.push({ year: y, top: toY(new Date(Date.UTC(y, 0, 1)).getTime()) });
	}

	return { rows, years, height: cursor };
}

// The document link and the notes expand/collapse affordance -- shared
// between the span-card and marker-card render below them, since every
// event kind can have either (a calibration certificate is just as much
// an "attached document" as a servicing-event PDF).
function CardExtras({
	documentId,
	documentName,
	notes,
	expanded,
}: {
	documentId: number | null | undefined;
	documentName: string | null | undefined;
	notes: string | null | undefined;
	expanded: boolean;
}) {
	const hasNotes = Boolean(notes?.trim());
	return (
		<>
			{documentId && (
				<MuiLink
					href={`/api/documents/${documentId}/file`}
					target="_blank"
					rel="noreferrer"
					onClick={(e) => e.stopPropagation()}
					sx={{
						display: "inline-flex",
						alignItems: "center",
						gap: 0.5,
						fontSize: 12.5,
						width: "fit-content",
						mt: 0.25,
					}}
				>
					<OpenInNewIcon sx={{ fontSize: 14 }} />
					{documentName ?? "Attached document"}
				</MuiLink>
			)}
			{hasNotes && (
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						gap: 0.25,
						mt: 0.25,
						color: "primary.main",
					}}
				>
					<Typography variant="caption" sx={{ fontWeight: 600 }}>
						Details
					</Typography>
					<ExpandMoreIcon
						sx={{
							fontSize: 16,
							transition: "transform 0.15s",
							transform: expanded ? "rotate(180deg)" : "none",
						}}
					/>
				</Box>
			)}
			{expanded && hasNotes && (
				<Box
					sx={{
						mt: 0.5,
						p: 1,
						maxHeight: 100,
						overflowY: "auto",
						borderRadius: 1,
						border: "1px dashed",
						borderColor: "divider",
						backgroundColor: "background.paper",
					}}
				>
					<Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
						{notes}
					</Typography>
				</Box>
			)}
		</>
	);
}

export default function AssetTimelineChart({
	events,
}: {
	events: TimelineEvent[];
}) {
	const router = useRouter();
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
	const { rows, years, height } = useMemo(
		() => layout(events, expandedIds),
		[events, expandedIds],
	);

	function toggleExpanded(id: string) {
		setExpandedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	if (events.length === 0) {
		return (
			<Typography color="text.disabled" sx={{ py: 4 }}>
				Nothing to show for the selected event types.
			</Typography>
		);
	}

	return (
		<Box sx={{ position: "relative", height, mt: 1 }}>
			<Box
				sx={{
					position: "absolute",
					left: AXIS_LINE_X,
					top: 4,
					bottom: 4,
					borderLeft: "2px dashed",
					borderColor: "divider",
				}}
			/>
			{years.map((y) => (
				<Typography
					key={y.year}
					variant="body2"
					sx={{
						position: "absolute",
						left: 0,
						width: AXIS_YEAR_WIDTH,
						top: y.top,
						textAlign: "right",
						fontWeight: 700,
						color: "text.secondary",
					}}
				>
					{y.year}
				</Typography>
			))}

			{rows.map(({ event, top }) => {
				const meta = KIND_META[event.kind];
				const dateLabel = timelineDateLabel(event, formatDate);
				const expanded = expandedIds.has(event.id);
				const hasNotes = Boolean(event.notes?.trim());
				const clickable = Boolean(event.href) || hasNotes;

				function handleClick() {
					if (event.href) {
						router.push(event.href as string);
						return;
					}
					if (hasNotes) toggleExpanded(event.id);
				}

				if (meta.cardStyle === "marker") {
					return (
						<Box
							key={event.id}
							sx={{
								position: "absolute",
								top,
								left: CONTENT_LEFT,
								right: CONTENT_RIGHT,
							}}
						>
							<Box
								onClick={clickable ? handleClick : undefined}
								sx={{
									display: "flex",
									alignItems: "flex-start",
									gap: 1.5,
									cursor: clickable ? "pointer" : "default",
								}}
							>
								<Box
									sx={{
										width: 16,
										height: 16,
										mt: "2px",
										borderRadius: "50%",
										border: "2px solid",
										borderColor: meta.color,
										backgroundColor: meta.fill,
										flexShrink: 0,
									}}
								/>
								<Box
									sx={{
										flex: 1,
										minWidth: 0,
										border: "1px solid",
										borderColor: "divider",
										borderLeft: "4px solid",
										borderLeftColor: meta.color,
										borderRadius: 1.5,
										px: 1.5,
										py: 0.75,
									}}
								>
									<Box
										sx={{
											display: "flex",
											justifyContent: "space-between",
											gap: 1,
										}}
									>
										<Typography variant="body2" sx={{ fontWeight: 700 }}>
											{event.label}
										</Typography>
										<Typography
											variant="caption"
											color="text.disabled"
											sx={{ whiteSpace: "nowrap" }}
										>
											{dateLabel}
										</Typography>
									</Box>
									{event.detail && (
										<Typography variant="caption" color="text.secondary">
											{event.detail}
										</Typography>
									)}
									<CardExtras
										documentId={event.documentId}
										documentName={event.documentName}
										notes={event.notes}
										expanded={expanded}
									/>
								</Box>
							</Box>
						</Box>
					);
				}

				return (
					<Box
						key={event.id}
						sx={{
							position: "absolute",
							top,
							left: CONTENT_LEFT,
							right: CONTENT_RIGHT,
						}}
					>
						<Box
							onClick={clickable ? handleClick : undefined}
							sx={{
								minHeight: MIN_SPAN_HEIGHT,
								borderRadius: 2,
								border: "2px solid",
								borderColor: meta.color,
								backgroundColor: meta.fill,
								px: 1.75,
								py: 1,
								display: "flex",
								flexDirection: "column",
								justifyContent: "center",
								gap: 0.25,
								cursor: clickable ? "pointer" : "default",
							}}
						>
							<Typography
								variant="caption"
								sx={{ fontWeight: 700, color: meta.color }}
							>
								{dateLabel}
							</Typography>
							<Typography variant="body2" sx={{ fontWeight: 700 }}>
								{event.label}
							</Typography>
							{event.detail && (
								<Typography variant="caption" color="text.secondary">
									{event.detail}
								</Typography>
							)}
							<CardExtras
								documentId={event.documentId}
								documentName={event.documentName}
								notes={event.notes}
								expanded={expanded}
							/>
						</Box>
					</Box>
				);
			})}
		</Box>
	);
}
