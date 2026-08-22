"use client";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import type { Mission } from "@ogdb/types";
import { useId, useMemo } from "react";
import { useChartTooltip } from "./useChartTooltip";

const CHART_WIDTH = 560;
const PLOT_H = 180;
const TOP = 10;
const BOTTOM = 26;
const LEFT = 44;
const RIGHT = 14;

function fmtDate(d: Date) {
	return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export default function CumulativeDaysChart({
	missions,
}: {
	missions: Mission[];
}) {
	const theme = useTheme();
	const gradientId = useId();
	const { show, hide, node } = useChartTooltip();
	const today = useMemo(() => new Date(), []);

	const points = useMemo(() => {
		const sorted = missions
			.filter((m) => m.launchDate && m.numberOfDays != null)
			.sort(
				(a, b) =>
					new Date(a.launchDate as string).getTime() -
					new Date(b.launchDate as string).getTime(),
			);
		let running = 0;
		const pts = sorted.map((m) => {
			running += m.numberOfDays ?? 0;
			return { date: new Date(m.launchDate as string), value: running };
		});
		if (pts.length > 0) pts.push({ date: today, value: running });
		return pts;
	}, [missions, today]);

	if (points.length === 0) {
		return (
			<Box
				sx={{
					color: "text.secondary",
					fontSize: 14,
					py: 4,
					textAlign: "center",
				}}
			>
				No missions with days recorded yet.
			</Box>
		);
	}

	const minDate = points[0].date;
	const maxDate = today;
	const maxV = points[points.length - 1].value * 1.1 || 1;
	const plotW = CHART_WIDTH - LEFT - RIGHT;

	function px(d: Date) {
		const span = maxDate.getTime() - minDate.getTime();
		const t = span === 0 ? 0 : (d.getTime() - minDate.getTime()) / span;
		return LEFT + t * plotW;
	}
	function py(v: number) {
		return TOP + PLOT_H - (v / maxV) * PLOT_H;
	}

	const linePts = points.map((p) => `${px(p.date)},${py(p.value)}`).join(" ");
	const areaPts = `${px(points[0].date)},${py(0)} ${linePts} ${px(points[points.length - 1].date)},${py(0)}`;

	const startYear = minDate.getFullYear();
	const endYear = maxDate.getFullYear();
	const years = [];
	for (let y = startYear; y <= endYear; y++) years.push(y);

	const height = TOP + PLOT_H + BOTTOM;

	return (
		<Box sx={{ overflowX: "auto" }}>
			<Box
				component="svg"
				viewBox={`0 0 ${CHART_WIDTH} ${height}`}
				sx={{ width: "100%", minWidth: 380, display: "block" }}
			>
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
						<stop
							offset="0%"
							stopColor={theme.palette.primary.main}
							stopOpacity={0.35}
						/>
						<stop
							offset="100%"
							stopColor={theme.palette.primary.main}
							stopOpacity={0.02}
						/>
					</linearGradient>
				</defs>

				{[0, 0.5, 1].map((f) => {
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
								x={LEFT - 6}
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

				<polygon points={areaPts} fill={`url(#${gradientId})`} />
				<polyline
					points={linePts}
					fill="none"
					stroke={theme.palette.primary.main}
					strokeWidth={2}
				/>

				{years.map((y) => {
					const xd = px(new Date(y, 0, 1));
					if (xd < LEFT || xd > CHART_WIDTH - RIGHT) return null;
					return (
						<text
							key={y}
							x={xd}
							y={TOP + PLOT_H + 16}
							fontSize={10.5}
							textAnchor="middle"
							fill={theme.palette.text.disabled}
						>
							{y}
						</text>
					);
				})}

				<rect
					x={LEFT}
					y={TOP}
					width={plotW}
					height={PLOT_H}
					fill="transparent"
					onMouseMove={(evt) => {
						const rect = (
							evt.target as SVGRectElement
						).ownerSVGElement?.getBoundingClientRect();
						if (!rect) return;
						const mx = ((evt.clientX - rect.left) / rect.width) * CHART_WIDTH;
						const closest = points.reduce((best, p) =>
							Math.abs(px(p.date) - mx) < Math.abs(px(best.date) - mx)
								? p
								: best,
						);
						show(
							evt,
							<>
								<Box
									component="span"
									sx={{ display: "block", fontWeight: 700, mb: 0.25 }}
								>
									{fmtDate(closest.date)}
								</Box>
								{closest.value.toLocaleString("en-GB")} cumulative days
							</>,
						);
					}}
					onMouseLeave={hide}
				/>
			</Box>
			{node}
		</Box>
	);
}
