"use client";

import { formatDate } from "@/lib/format";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useTheme } from "@mui/material/styles";
import type { Mission } from "@ogdb/types";
import { useMemo, useState } from "react";
import { useChartTooltip } from "./useChartTooltip";

const METRICS = {
	days: {
		label: "Days",
		axisLabel: "Days",
		unit: " d",
		get: (m: Mission) => m.numberOfDays,
	},
	km: {
		label: "Distance",
		axisLabel: "Distance (km)",
		unit: " km",
		get: (m: Mission) =>
			m.distanceKm != null ? Math.round(m.distanceKm) : null,
	},
	dives: {
		label: "Dives",
		axisLabel: "Dives",
		unit: "",
		get: (m: Mission) => m.dives,
	},
} as const;

type MetricKey = keyof typeof METRICS;

const CHART_WIDTH = 560;
const PLOT_H = 190;
const TOP = 14;
const BOTTOM = 56;
const LEFT = 56;
const RIGHT = 8;
const Y_TICKS = [0, 0.5, 1];

// Bars share a fixed-width chart evenly, however many missions there are
// -- gap shrinks as the mission count grows so bars stay as wide as
// possible, rather than capping the mission count or scrolling.
function barGapFor(count: number): number {
	if (count > 60) return 1;
	if (count > 30) return 2;
	if (count > 15) return 4;
	return 6;
}

export default function MissionComparisonChart({
	missions,
}: {
	missions: Mission[];
}) {
	const theme = useTheme();
	const [metric, setMetric] = useState<MetricKey>("days");
	const { show, hide, node } = useChartTooltip();

	// Every mission gets a slot, in mission-number order, regardless of
	// whether it has a value for the currently selected metric -- a
	// mission missing e.g. a dive count should show up as a gap here, not
	// silently disappear from the chart.
	const rows = useMemo(
		() =>
			[...missions].sort((a, b) => {
				const an = a.missionNumber ?? Number.POSITIVE_INFINITY;
				const bn = b.missionNumber ?? Number.POSITIVE_INFINITY;
				return an !== bn ? an - bn : a.id - b.id;
			}),
		[missions],
	);

	const meta = METRICS[metric];
	const values = rows.map((m) => meta.get(m));
	const maxV =
		Math.max(1, ...values.filter((v): v is number => v != null)) * 1.12;
	const plotW = CHART_WIDTH - LEFT - RIGHT;
	const barGap = barGapFor(rows.length);
	const barW = rows.length ? Math.max(1, plotW / rows.length - barGap) : 0;
	const height = TOP + PLOT_H + BOTTOM;
	const showValueLabels = barW >= 14;

	return (
		<Box>
			<Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
				<ToggleButtonGroup
					size="small"
					exclusive
					value={metric}
					onChange={(_evt, next) => next && setMetric(next)}
				>
					{Object.entries(METRICS).map(([key, m]) => (
						<ToggleButton
							key={key}
							value={key}
							sx={{ px: 1.5, fontSize: 12.5 }}
						>
							{m.label}
						</ToggleButton>
					))}
				</ToggleButtonGroup>
			</Box>

			{rows.length === 0 ? (
				<Box
					sx={{
						color: "text.secondary",
						fontSize: 14,
						py: 4,
						textAlign: "center",
					}}
				>
					No missions yet.
				</Box>
			) : (
				<Box sx={{ overflowX: "auto" }}>
					<Box
						component="svg"
						viewBox={`0 0 ${CHART_WIDTH} ${height}`}
						sx={{ width: "100%", minWidth: 420, display: "block" }}
					>
						{Y_TICKS.map((f) => {
							const y = TOP + PLOT_H - f * PLOT_H;
							return (
								<g key={f}>
									<line
										x1={LEFT}
										x2={CHART_WIDTH - RIGHT}
										y1={y}
										y2={y}
										stroke={theme.palette.divider}
									/>
									<text
										x={LEFT - 8}
										y={y + 3}
										fontSize={10.5}
										textAnchor="end"
										fill={theme.palette.text.disabled}
									>
										{Math.round(f * maxV).toLocaleString("en-GB")}
									</text>
								</g>
							);
						})}
						<text
							x={16}
							y={TOP + PLOT_H / 2}
							fontSize={8.5}
							fontWeight={600}
							textAnchor="middle"
							fill={theme.palette.text.secondary}
							transform={`rotate(-90 16 ${TOP + PLOT_H / 2})`}
						>
							{meta.axisLabel}
						</text>
						<text
							x={LEFT + plotW / 2}
							y={height - 8}
							fontSize={8.5}
							fontWeight={600}
							textAnchor="middle"
							fill={theme.palette.text.secondary}
						>
							Mission ID
						</text>
						{rows.map((m, i) => {
							const v = values[i];
							const x = LEFT + i * (barW + barGap);
							const label =
								m.stdMissionName ?? m.missionName ?? `Mission ${m.id}`;
							const distance =
								m.distanceKm != null ? `${Math.round(m.distanceKm)} km` : "—";

							return (
								<g
									key={m.id}
									style={{ cursor: "default" }}
									onMouseMove={(evt) =>
										show(
											evt,
											<>
												<Box
													component="span"
													sx={{ display: "block", fontWeight: 700, mb: 0.25 }}
												>
													{label}
												</Box>
												Mission {m.id}
												<br />
												{formatDate(m.launchDate)} →{" "}
												{formatDate(m.recoveryDate)}
												<br />
												{m.numberOfDays ?? "—"} days | {m.dives ?? "—"} dives |{" "}
												{distance}
											</>,
										)
									}
									onMouseLeave={hide}
								>
									<rect
										x={x}
										y={TOP}
										width={barW}
										height={PLOT_H}
										fill="transparent"
									/>
									{v != null && (
										<>
											<rect
												x={x}
												y={TOP + PLOT_H - (v / maxV) * PLOT_H}
												width={barW}
												height={(v / maxV) * PLOT_H}
												rx={Math.min(3, barW / 4)}
												fill={theme.palette.primary.main}
											/>
											{showValueLabels && (
												<text
													x={x + barW / 2}
													y={TOP + PLOT_H - (v / maxV) * PLOT_H - 5}
													fontSize={11}
													fontWeight={600}
													textAnchor="middle"
													fill={theme.palette.text.secondary}
												>
													{v}
												</text>
											)}
										</>
									)}
									{i % 5 === 0 && (
										<text
											x={x + barW / 2}
											y={TOP + PLOT_H + 12}
											fontSize={7}
											textAnchor="middle"
											fill={theme.palette.text.disabled}
										>
											{m.id}
										</text>
									)}
								</g>
							);
						})}
					</Box>
				</Box>
			)}
			{node}
		</Box>
	);
}
