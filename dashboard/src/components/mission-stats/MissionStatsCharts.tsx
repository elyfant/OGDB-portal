"use client";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import type { Mission } from "@ogdb/types";
import { useMemo } from "react";
import ActivityHeatmap from "./ActivityHeatmap";
import ChartCard from "./ChartCard";
import CumulativeDaysChart from "./CumulativeDaysChart";
import DeploymentTimeline from "./DeploymentTimeline";
import MissionComparisonChart from "./MissionComparisonChart";
import RankedBarChart, { type RankedBarRow } from "./RankedBarChart";
import { buildGliderColorMap, buildRankedColorMap } from "./colors";

export default function MissionStatsCharts({
	missions,
}: {
	missions: Mission[];
}) {
	const theme = useTheme();
	const mode = theme.palette.mode;

	const gliderNames = useMemo(
		() =>
			Array.from(
				new Set(missions.map((m) => m.glider).filter((g): g is string => !!g)),
			).sort((a, b) => a.localeCompare(b)),
		[missions],
	);
	const gliderColors = useMemo(
		() => buildGliderColorMap(gliderNames, mode),
		[gliderNames, mode],
	);

	const projectRows: RankedBarRow[] = useMemo(() => {
		const totals = new Map<string, number>();
		for (const m of missions) {
			if (!m.project || m.numberOfDays == null) continue;
			totals.set(m.project, (totals.get(m.project) ?? 0) + m.numberOfDays);
		}
		const ranked = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
		const projectColors = buildRankedColorMap(
			ranked.map(([project]) => project),
			mode,
		);
		return ranked.map(([project, value]) => ({
			key: project,
			label: project,
			value,
			color: projectColors.get(project),
		}));
	}, [missions, mode]);

	const gliderRows: RankedBarRow[] = useMemo(() => {
		const totals = new Map<string, number>();
		for (const m of missions) {
			if (!m.glider || m.numberOfDays == null) continue;
			totals.set(m.glider, (totals.get(m.glider) ?? 0) + m.numberOfDays);
		}
		return Array.from(totals.entries())
			.map(([glider, value]) => ({
				key: glider,
				label: glider,
				value,
				color: gliderColors.get(glider),
			}))
			.sort((a, b) => b.value - a.value);
	}, [missions, gliderColors]);

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
			<ChartCard
				title="Deployment timeline"
				description="One row per group, ranked by total days in the water — switch what it's grouped by, or click a row to isolate it. Hover a bar for the mission."
			>
				<DeploymentTimeline missions={missions} />
			</ChartCard>

			<ChartCard
				title="Mission comparison"
				description="Most recent missions, one bar per mission."
			>
				<MissionComparisonChart missions={missions} />
			</ChartCard>

			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
					gap: 2,
				}}
			>
				<ChartCard
					title="Days by project"
					description="Total mission-days, summed across every glider that contributed."
				>
					<RankedBarChart rows={projectRows} valueSuffix=" d" />
				</ChartCard>
				<ChartCard
					title="Fleet utilization"
					description="Lifetime days in water, ranked by glider."
				>
					<RankedBarChart rows={gliderRows} valueSuffix=" d" />
				</ChartCard>
			</Box>

			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
					gap: 2,
				}}
			>
				<ChartCard
					title="Cumulative fleet-days"
					description="Running total of days at sea, program to date."
				>
					<CumulativeDaysChart missions={missions} />
				</ChartCard>
				<ChartCard
					title="Activity calendar"
					description="Mission-days per month — darker cells mean more of the fleet was in the water that month."
				>
					<ActivityHeatmap missions={missions} />
				</ChartCard>
			</Box>
		</Box>
	);
}
