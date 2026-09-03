"use client";

import AssetTimelineChart from "@/components/AssetTimelineChart";
import {
	KIND_META,
	type TimelineEvent,
	type TimelineEventKind,
} from "@/lib/timeline";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import { useState } from "react";

const CHIP_KINDS: TimelineEventKind[] = [
	"mission",
	"calibration",
	"factory_repair",
	"servicing",
	"transit",
	"on_loan",
	"field_test",
	"missing",
	"destroyed",
];

// The filter chips + the chart, as one reusable unit -- shared by the
// glider Timeline tab and the asset detail page. `events` is already
// fully built by the caller (missions/calibrations/servicing folded
// together however makes sense for that page); this component only
// owns which kinds are toggled on.
export default function AssetTimelineSection({
	events,
}: {
	events: TimelineEvent[];
}) {
	const [activeKinds, setActiveKinds] = useState<Set<TimelineEventKind>>(
		new Set(CHIP_KINDS),
	);
	function toggleKind(kind: TimelineEventKind) {
		setActiveKinds((prev) => {
			const next = new Set(prev);
			if (next.has(kind)) next.delete(kind);
			else next.add(kind);
			return next;
		});
	}

	const visibleEvents = events.filter((e) => activeKinds.has(e.kind));

	return (
		<Box>
			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
				{CHIP_KINDS.map((kind) => {
					const meta = KIND_META[kind];
					const count = events.filter((e) => e.kind === kind).length;
					const active = activeKinds.has(kind);
					return (
						<Chip
							key={kind}
							label={`${meta.label} · ${count}`}
							onClick={() => toggleKind(kind)}
							variant={active ? "filled" : "outlined"}
							sx={{
								borderColor: meta.color,
								...(active && {
									backgroundColor: meta.fill,
									color: meta.color,
								}),
								fontWeight: 600,
							}}
						/>
					);
				})}
			</Box>

			<AssetTimelineChart events={visibleEvents} />
		</Box>
	);
}
