"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useTheme } from "@mui/material/styles";
import type { Mission } from "@ogdb/types";
import { useId, useMemo, useState } from "react";
import { buildRankedColorMap } from "./colors";
import { siteToArea } from "./site-areas";
import { useChartTooltip } from "./useChartTooltip";

const DIMENSIONS = {
	area: { label: "Area", get: (m: Mission) => siteToArea(m.site) },
	site: { label: "Site", get: (m: Mission) => m.site ?? "Unknown site" },
	project: {
		label: "Project",
		get: (m: Mission) => m.project ?? "Unknown project",
	},
	glider: {
		label: "Glider",
		get: (m: Mission) => m.glider ?? "Unknown glider",
	},
} as const;

type DimensionKey = keyof typeof DIMENSIONS;

const ROW_HEIGHT = 34;
const BAR_HEIGHT = 18;
const BAR_FILL_OPACITY = 0.55;
const TOP = 26;
const LEFT = 136;
const RIGHT = 20;
const CHART_WIDTH = 900;
const MAX_ROW_LABEL_CHARS = 22;

function fmtDate(d: Date) {
	return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function truncate(label: string, max: number): string {
	if (label.length <= max) return label;
	return `${label.slice(0, max - 1)}…`;
}

export default function DeploymentTimeline({
	missions,
}: {
	missions: Mission[];
}) {
	const theme = useTheme();
	const mode = theme.palette.mode;
	const patternPrefix = useId();
	const { show, hide, node } = useChartTooltip();

	const [dimension, setDimension] = useState<DimensionKey>("area");
	const [highlighted, setHighlighted] = useState<string | null>(null);
	const groupOf = DIMENSIONS[dimension].get;

	const today = useMemo(() => new Date(), []);

	// Groups ranked by total days in the water, most first -- the
	// timeline gives each one a fixed row in this order (and a color to
	// match), rather than packing missions into the fewest rows possible.
	const groupOrder = useMemo(() => {
		const totals = new Map<string, number>();
		for (const m of missions) {
			if (m.numberOfDays == null) continue;
			const group = groupOf(m);
			totals.set(group, (totals.get(group) ?? 0) + m.numberOfDays);
		}
		return Array.from(totals.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([group]) => group);
	}, [missions, groupOf]);
	const groupColors = useMemo(
		() => buildRankedColorMap(groupOrder, mode),
		[groupOrder, mode],
	);
	const groupRow = useMemo(
		() => new Map(groupOrder.map((group, i) => [group, i])),
		[groupOrder],
	);

	const dated = useMemo(
		() =>
			missions
				.filter((m) => m.launchDate)
				.map((m) => {
					const group = groupOf(m);
					return {
						mission: m,
						group,
						start: new Date(m.launchDate as string),
						end: m.recoveryDate ? new Date(m.recoveryDate) : today,
						active: !m.recoveryDate,
						row: groupRow.get(group),
					};
				})
				.filter((d): d is typeof d & { row: number } => d.row !== undefined)
				.sort((a, b) => a.start.getTime() - b.start.getTime()),
		[missions, today, groupOf, groupRow],
	);

	const rowCount = groupOrder.length;

	const { minDate, maxDate } = useMemo(() => {
		if (dated.length === 0) return { minDate: today, maxDate: today };
		const min = new Date(Math.min(...dated.map((d) => d.start.getTime())));
		min.setMonth(min.getMonth() - 1);
		return { minDate: min, maxDate: today };
	}, [dated, today]);

	const width = CHART_WIDTH - LEFT - RIGHT;
	function x(d: Date) {
		const span = maxDate.getTime() - minDate.getTime();
		const t = span === 0 ? 0 : (d.getTime() - minDate.getTime()) / span;
		return LEFT + t * width;
	}

	const height = TOP + rowCount * ROW_HEIGHT + 8;

	const startYear = minDate.getFullYear();
	const endYear = maxDate.getFullYear();
	const years = [];
	for (let y = startYear; y <= endYear + 1; y++) years.push(y);

	function changeDimension(next: DimensionKey | null) {
		if (!next) return;
		setDimension(next);
		setHighlighted(null);
	}

	return (
		<Box>
			<Box
				sx={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					flexWrap: "wrap",
					gap: 1,
					mb: 2,
				}}
			>
				<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
					{groupOrder.map((group) => {
						const color = groupColors.get(group) as string;
						const selected = highlighted === null || highlighted === group;
						return (
							<Chip
								key={group}
								label={group}
								size="small"
								onClick={() =>
									setHighlighted((h) => (h === group ? null : group))
								}
								sx={{
									fontWeight: 600,
									border: "1px solid",
									borderColor: color,
									bgcolor: selected ? `${color}22` : "transparent",
									color: selected ? color : "text.disabled",
									opacity: selected ? 1 : 0.6,
								}}
							/>
						);
					})}
				</Box>
				<ToggleButtonGroup
					size="small"
					exclusive
					value={dimension}
					onChange={(_evt, next) => changeDimension(next)}
				>
					{Object.entries(DIMENSIONS).map(([key, d]) => (
						<ToggleButton
							key={key}
							value={key}
							sx={{ px: 1.5, fontSize: 12.5 }}
						>
							{d.label}
						</ToggleButton>
					))}
				</ToggleButtonGroup>
			</Box>

			{rowCount === 0 || dated.length === 0 ? (
				<Box
					sx={{
						color: "text.secondary",
						fontSize: 14,
						py: 4,
						textAlign: "center",
					}}
				>
					No missions with a launch date yet.
				</Box>
			) : (
				<Box sx={{ overflowX: "auto" }}>
					<Box
						component="svg"
						viewBox={`0 0 ${CHART_WIDTH} ${height}`}
						sx={{ width: "100%", minWidth: 760, display: "block" }}
					>
						{groupOrder.map((group, row) => {
							const color = groupColors.get(group) as string;
							const y = TOP + row * ROW_HEIGHT;
							const dimmed = highlighted !== null && group !== highlighted;
							return (
								<g
									key={group}
									opacity={dimmed ? 0.35 : 1}
									style={{ transition: "opacity 0.12s ease" }}
								>
									<rect
										x={LEFT}
										y={y}
										width={width}
										height={ROW_HEIGHT}
										fill={
											row % 2 === 0 ? theme.palette.action.hover : "transparent"
										}
									/>
									<text
										x={LEFT - 10}
										y={y + ROW_HEIGHT / 2 + 3.5}
										fontSize={11.5}
										fontWeight={600}
										textAnchor="end"
										fill={color}
									>
										{truncate(group, MAX_ROW_LABEL_CHARS)}
									</text>
								</g>
							);
						})}

						{years.map((y) => {
							const xd = x(new Date(y, 0, 1));
							if (xd < LEFT || xd > LEFT + width) return null;
							return (
								<g key={y}>
									<line
										x1={xd}
										x2={xd}
										y1={TOP}
										y2={TOP + rowCount * ROW_HEIGHT}
										stroke={theme.palette.divider}
									/>
									<text
										x={xd + 4}
										y={TOP - 10}
										fontSize={10.5}
										fill={theme.palette.text.disabled}
									>
										{y}
									</text>
								</g>
							);
						})}

						<line
							x1={x(today)}
							x2={x(today)}
							y1={TOP}
							y2={TOP + rowCount * ROW_HEIGHT}
							stroke={theme.palette.primary.main}
							strokeWidth={1.5}
							strokeDasharray="3,3"
						/>

						{dated.map(({ mission, group, start, end, active, row }, i) => {
							const label =
								mission.stdMissionName ??
								mission.missionName ??
								`Mission ${mission.id}`;
							const color = groupColors.get(group) as string;
							const dimmed = highlighted !== null && group !== highlighted;
							const y = TOP + row * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
							const x1 = x(start);
							const x2 = x(end);
							const barWidth = Math.max(x2 - x1, 3);
							const patternId = `${patternPrefix}-hatch-${i}`;

							return (
								<g
									key={mission.id}
									opacity={dimmed ? 0.25 : 1}
									style={{
										cursor: "default",
										transition: "opacity 0.12s ease",
									}}
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
												{mission.site ?? "No site"} ·{" "}
												{mission.glider ?? "No glider"}
												{mission.project ? ` · ${mission.project}` : ""}
												<br />
												{fmtDate(start)} → {active ? "ongoing" : fmtDate(end)}
												{mission.numberOfDays != null && (
													<>
														<br />
														{mission.numberOfDays} days
														{mission.distanceKm != null &&
															` · ${Math.round(mission.distanceKm)} km`}
														{mission.dives != null &&
															` · ${mission.dives} dives`}
													</>
												)}
											</>,
										)
									}
									onMouseLeave={hide}
								>
									{active && (
										<pattern
											id={patternId}
											width={6}
											height={6}
											patternTransform="rotate(45)"
											patternUnits="userSpaceOnUse"
										>
											<rect
												width={6}
												height={6}
												fill={color}
												fillOpacity={BAR_FILL_OPACITY}
											/>
											<line
												x1={0}
												y1={0}
												x2={0}
												y2={6}
												stroke="rgba(255,255,255,0.55)"
												strokeWidth={2}
											/>
										</pattern>
									)}
									<rect
										x={x1}
										y={y}
										width={barWidth}
										height={BAR_HEIGHT}
										rx={4}
										fill={active ? `url(#${patternId})` : color}
										fillOpacity={active ? 1 : BAR_FILL_OPACITY}
									/>
								</g>
							);
						})}
					</Box>
					{node}
				</Box>
			)}
		</Box>
	);
}
