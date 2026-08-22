"use client";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import type { Mission } from "@ogdb/types";
import { useMemo } from "react";
import { magnitudeColor } from "./colors";
import { useChartTooltip } from "./useChartTooltip";

const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];
const CELL_W = 34;
const CELL_H = 18;
const GAP = 4;
const LEFT = 38;
const TOP = 20;

function daysBetween(a: Date, b: Date) {
	return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export default function ActivityHeatmap({ missions }: { missions: Mission[] }) {
	const theme = useTheme();
	const mode = theme.palette.mode;
	const { show, hide, node } = useChartTooltip();
	const today = useMemo(() => new Date(), []);

	const { monthTotals, years, maxV } = useMemo(() => {
		const totals = new Map<string, number>();
		let minYear = today.getFullYear();

		for (const m of missions) {
			if (!m.launchDate) continue;
			const start = new Date(m.launchDate);
			const end = m.recoveryDate ? new Date(m.recoveryDate) : today;
			minYear = Math.min(minYear, start.getFullYear());

			let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
			while (cursor <= end) {
				const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
				const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
				const monthEnd = new Date(
					cursor.getFullYear(),
					cursor.getMonth() + 1,
					1,
				);
				const overlapStart = start > monthStart ? start : monthStart;
				const overlapEnd = end < monthEnd ? end : monthEnd;
				const overlapDays = Math.max(0, daysBetween(overlapStart, overlapEnd));
				totals.set(key, (totals.get(key) ?? 0) + overlapDays);
				cursor = monthEnd;
			}
		}

		const yearList: number[] = [];
		for (let y = minYear; y <= today.getFullYear(); y++) yearList.push(y);
		const max = totals.size ? Math.max(...totals.values()) : 0;
		return { monthTotals: totals, years: yearList, maxV: max };
	}, [missions, today]);

	if (years.length === 0) {
		return (
			<Box
				sx={{
					color: "text.secondary",
					fontSize: 14,
					py: 4,
					textAlign: "center",
				}}
			>
				No missions with launch dates yet.
			</Box>
		);
	}

	const chartWidth = LEFT + MONTHS.length * (CELL_W + GAP) + 10;
	const height = TOP + years.length * (CELL_H + GAP) + 10;

	return (
		<Box sx={{ overflowX: "auto", display: "flex", justifyContent: "center" }}>
			<Box
				component="svg"
				viewBox={`0 0 ${chartWidth} ${height}`}
				width={chartWidth}
				height={height}
				sx={{ display: "block", flexShrink: 0 }}
			>
				{MONTHS.map((mn, i) => (
					<text
						key={mn}
						x={LEFT + i * (CELL_W + GAP) + CELL_W / 2}
						y={TOP - 8}
						fontSize={10.5}
						textAnchor="middle"
						fill={theme.palette.text.disabled}
					>
						{mn}
					</text>
				))}
				{years.map((yr, ri) => (
					<g key={yr}>
						<text
							x={LEFT - 10}
							y={TOP + ri * (CELL_H + GAP) + CELL_H / 2 + 4}
							fontSize={10.5}
							textAnchor="end"
							fill={theme.palette.text.disabled}
						>
							{yr}
						</text>
						{MONTHS.map((mn, ci) => {
							const key = `${yr}-${ci}`;
							const v = monthTotals.get(key) ?? 0;
							const isFuture = new Date(yr, ci, 1) > today;
							const x = LEFT + ci * (CELL_W + GAP);
							const y = TOP + ri * (CELL_H + GAP);
							if (isFuture) {
								return (
									<rect
										key={key}
										x={x}
										y={y}
										width={CELL_W}
										height={CELL_H}
										rx={4}
										fill="none"
										stroke={theme.palette.divider}
										strokeDasharray="2,2"
									/>
								);
							}
							return (
								<rect
									key={key}
									x={x}
									y={y}
									width={CELL_W}
									height={CELL_H}
									rx={4}
									fill={magnitudeColor(maxV ? v / maxV : 0, mode)}
									style={{ cursor: "default" }}
									onMouseMove={(evt) =>
										show(
											evt,
											<>
												<Box
													component="span"
													sx={{ display: "block", fontWeight: 700, mb: 0.25 }}
												>
													{mn} {yr}
												</Box>
												{v} mission-days across the fleet
											</>,
										)
									}
									onMouseLeave={hide}
								/>
							);
						})}
					</g>
				))}
			</Box>
			{node}
		</Box>
	);
}
