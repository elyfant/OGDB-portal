"use client";

import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { BarChart } from "@mui/x-charts/BarChart";
import type { IridiumMissionDetail } from "@ogdb/types";
import Link from "next/link";
import { AVG_MONTH_DAYS, formatMonth, formatUsd0 } from "../../lib/iridium";
import { useIridiumColors } from "./colors";

function Figure({ label, value }: { label: string; value: string }) {
	return (
		<Box>
			<Typography variant="caption" color="text.secondary" display="block">
				{label}
			</Typography>
			<Typography variant="h6" sx={{ fontWeight: 600 }}>
				{value}
			</Typography>
		</Box>
	);
}

export default function MissionIridiumSection({
	detail,
}: {
	detail: IridiumMissionDetail;
}) {
	const colors = useIridiumColors();
	const { cost, months } = detail;

	if (!cost || cost.invoicedMonths === 0) {
		return (
			<Paper variant="outlined" sx={{ p: 3 }}>
				<Typography color="text.secondary">
					No Iridium invoice covers this mission: it ran before the invoice
					record starts (Jan 2020), or its glider's SIM isn't in OGDB.
				</Typography>
			</Paper>
		);
	}

	const m = months.map((r) => r.month);
	const fmt = (v: number | null) => formatUsd0(v);
	return (
		<Paper variant="outlined" sx={{ p: 3 }}>
			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 4, mb: 2 }}>
				<Figure label="Total" value={formatUsd0(cost.totalUsd)} />
				<Figure
					label="Total (NOK, est.)"
					value={
						cost.totalNok === null
							? "—"
							: `kr ${Math.round(cost.totalNok).toLocaleString("nb-NO")}`
					}
				/>
				<Figure label="Per day" value={formatUsd0(cost.usdPerDay)} />
				<Figure
					label="Per month"
					value={formatUsd0(
						cost.usdPerDay === null ? null : cost.usdPerDay * AVG_MONTH_DAYS,
					)}
				/>
				<Figure
					label="Months invoiced"
					value={`${cost.invoicedMonths} of ${cost.missionMonths}${cost.fullyInvoiced ? "" : " †"}`}
				/>
			</Box>
			<BarChart
				height={240}
				xAxis={[
					{
						scaleType: "band",
						data: m,
						valueFormatter: (v: string) => formatMonth(v),
					},
				]}
				yAxis={[{ valueFormatter: (v: number) => formatUsd0(v) }]}
				series={[
					{
						data: months.map((r) => r.beforeLaunchUsd),
						label: "Before launch",
						stack: "t",
						color: colors.beforeLaunch,
						valueFormatter: fmt,
					},
					{
						data: months.map((r) => r.missionUsageUsd),
						label: "Usage",
						stack: "t",
						color: colors.missionUsage,
						valueFormatter: fmt,
					},
					{
						data: months.map((r) => r.missionRentalUsd),
						label: "Line rental",
						stack: "t",
						color: colors.missionRental,
						valueFormatter: fmt,
					},
					{
						data: months.map((r) => r.afterRecoveryUsd),
						label: "After recovery",
						stack: "t",
						color: colors.afterRecovery,
						valueFormatter: fmt,
					},
				]}
				margin={{ left: 70 }}
			/>
			<Typography variant="caption" color="text.secondary">
				{cost.fullyInvoiced
					? ""
					: "† Some months have no invoice, so the total is too low. "}
				Before launch / after recovery: airtime in the month either side,
				charged to this mission.{" "}
				<MuiLink component={Link} href="/iridium">
					All Iridium costs
				</MuiLink>
			</Typography>
		</Paper>
	);
}
