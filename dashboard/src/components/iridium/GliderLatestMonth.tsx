"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { SparkLineChart } from "@mui/x-charts/SparkLineChart";
import type { IridiumGliderMonth } from "@ogdb/types";
import Link from "next/link";
import {
	PLATFORM_LABEL,
	formatMonth,
	formatUsd0,
	monthsEndingAt,
} from "../../lib/iridium";
import { useIridiumColors } from "./colors";

interface GliderSeries {
	id: number;
	name: string;
	platform: string;
	usd: number[]; // aligned with `months`
	latestUsd: number;
	onMission: boolean;
}

export default function GliderLatestMonth({
	rows,
	lastMonth,
}: {
	rows: IridiumGliderMonth[];
	lastMonth: string;
}) {
	const colors = useIridiumColors();
	const months = monthsEndingAt(lastMonth, 12);

	const byGlider = new Map<number, GliderSeries>();
	for (const r of rows) {
		let g = byGlider.get(r.gliderAssetId);
		if (!g) {
			g = {
				id: r.gliderAssetId,
				name: r.gliderName,
				platform: r.platform,
				usd: months.map(() => 0),
				latestUsd: 0,
				onMission: false,
			};
			byGlider.set(r.gliderAssetId, g);
		}
		const i = months.indexOf(r.month);
		if (i >= 0) g.usd[i] = r.usd;
		if (r.month === lastMonth) {
			g.latestUsd = r.usd;
			g.onMission = r.missionUsd > 0;
		}
	}
	const gliders = [...byGlider.values()].sort(
		(a, b) =>
			a.platform.localeCompare(b.platform) || a.name.localeCompare(b.name),
	);

	return (
		<Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
			<Box
				sx={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "baseline",
					flexWrap: "wrap",
					gap: 1,
					mb: 2,
				}}
			>
				<Typography variant="h6">
					Latest month per glider · {formatMonth(lastMonth)}
				</Typography>
				<Typography variant="body2" color="text.secondary">
					Bars: the last 12 invoiced months
				</Typography>
			</Box>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
					gap: 1.5,
				}}
			>
				{gliders.map((g) => (
					<Paper key={g.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
						<Box
							sx={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								gap: 1,
							}}
						>
							<MuiLink
								component={Link}
								href={`/gliders/${g.id}`}
								underline="hover"
								sx={{ fontWeight: 600 }}
							>
								{g.name}
							</MuiLink>
							<Chip
								size="small"
								label={g.onMission ? "On mission" : "Idle"}
								color={g.onMission ? "primary" : "default"}
								variant={g.onMission ? "filled" : "outlined"}
							/>
						</Box>
						<Typography variant="caption" color="text.secondary">
							{PLATFORM_LABEL[g.platform] ?? g.platform}
						</Typography>
						<Typography variant="h6" sx={{ fontWeight: 600 }}>
							{formatUsd0(g.latestUsd)}
						</Typography>
						<SparkLineChart
							plotType="bar"
							data={g.usd}
							height={40}
							colors={[colors.missionUsage]}
							showTooltip
							xAxis={{
								scaleType: "band",
								data: months,
								valueFormatter: (m: string) => formatMonth(m),
							}}
							valueFormatter={(v) => formatUsd0(v)}
						/>
					</Paper>
				))}
			</Box>
		</Paper>
	);
}
