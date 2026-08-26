"use client";

import { formatDate } from "@/lib/format";
import { KIND_META, type TimelineEvent } from "@/lib/timeline";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

const PX_PER_DAY = 0.6;
const MIN_SPAN_HEIGHT = 56;
const MIN_MARKER_HEIGHT = 40;
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
// collapsing into an unreadable stack.
function layout(events: TimelineEvent[]) {
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
		const rawHeight = e.instant
			? MIN_MARKER_HEIGHT
			: Math.max(
					MIN_SPAN_HEIGHT,
					toY(new Date(endOrToday(e, todayIso)).getTime()) - rawTop,
				);
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

export default function AssetTimelineChart({
	events,
}: {
	events: TimelineEvent[];
}) {
	const router = useRouter();
	const { rows, years, height } = useMemo(() => layout(events), [events]);

	if (events.length === 0) {
		return (
			<Typography color="text.disabled" sx={{ py: 4 }}>
				Nothing to show for the selected event types.
			</Typography>
		);
	}

	return (
		<Box sx={{ position: "relative", pl: "150px", pr: 3, height, mt: 1 }}>
			<Box
				sx={{
					position: "absolute",
					left: 130,
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
						width: 110,
						top: y.top,
						textAlign: "right",
						fontWeight: 700,
						color: "text.secondary",
					}}
				>
					{y.year}
				</Typography>
			))}

			{rows.map(({ event, top, height: h }) => {
				const meta = KIND_META[event.kind];
				const dateLabel = event.instant
					? formatDate(event.startDate)
					: `${formatDate(event.startDate)} – ${
							event.endDate ? formatDate(event.endDate) : "ongoing"
						}`;

				if (!event.instant) {
					const href = event.href;
					return (
						<Box
							key={event.id}
							sx={{
								position: "absolute",
								top,
								height: h,
								left: 0,
								right: 0,
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
								cursor: href ? "pointer" : "default",
							}}
							onClick={href ? () => router.push(href) : undefined}
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
						</Box>
					);
				}

				return (
					<Box
						key={event.id}
						sx={{
							position: "absolute",
							top,
							height: h,
							left: 0,
							right: 0,
							display: "flex",
							alignItems: "center",
							gap: 1.5,
						}}
					>
						<Box
							sx={{
								width: 16,
								height: 16,
								borderRadius: "50%",
								border: "2px solid",
								borderColor: meta.color,
								backgroundColor: meta.fill,
								flexShrink: 0,
								ml: "-8px",
							}}
						/>
						<Box
							sx={{
								flex: 1,
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
								<Typography variant="caption" color="text.disabled">
									{dateLabel}
								</Typography>
							</Box>
							{event.detail && (
								<Typography variant="caption" color="text.secondary">
									{event.detail}
								</Typography>
							)}
						</Box>
					</Box>
				);
			})}
		</Box>
	);
}
