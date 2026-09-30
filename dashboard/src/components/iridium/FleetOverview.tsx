"use client";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Typography from "@mui/material/Typography";
import { BarChart } from "@mui/x-charts/BarChart";
import type { IridiumMonthlyCost } from "@ogdb/types";
import { formatMonth, formatUsd0 } from "../../lib/iridium";
import { useIridiumColors } from "./colors";

const OVERHEAD = new Set(["idle_usage", "idle_rental"]);

export default function FleetOverview({
	monthly,
}: {
	monthly: IridiumMonthlyCost[];
}) {
	const colors = useIridiumColors();
	const months = [...new Set(monthly.map((r) => r.month))].sort();
	const mission = months.map(() => 0);
	const overhead = months.map(() => 0);
	let unassigned = 0;
	for (const r of monthly) {
		const i = months.indexOf(r.month);
		if (OVERHEAD.has(r.category)) overhead[i] += r.usd;
		else mission[i] += r.usd;
		if (r.platform === "unassigned") unassigned += r.usd;
	}

	return (
		<Accordion variant="outlined" disableGutters>
			<AccordionSummary expandIcon={<ExpandMoreIcon />}>
				<Typography>
					Fleet overview: monthly cost, missions vs overhead
				</Typography>
			</AccordionSummary>
			<AccordionDetails>
				<BarChart
					height={300}
					xAxis={[
						{
							scaleType: "band",
							data: months,
							valueFormatter: (m: string, ctx) =>
								ctx.location === "tick" ? m.slice(0, 4) : formatMonth(m),
							tickInterval: (m: string) => m.endsWith("-01"),
						},
					]}
					yAxis={[{ valueFormatter: (v: number) => formatUsd0(v) }]}
					series={[
						{
							data: mission,
							label: "On missions",
							stack: "t",
							color: colors.missionUsage,
							valueFormatter: (v) => formatUsd0(v),
						},
						{
							data: overhead,
							label: "Overhead (idle SIMs)",
							stack: "t",
							color: colors.overhead,
							valueFormatter: (v) => formatUsd0(v),
						},
					]}
					margin={{ left: 70 }}
				/>
				<Typography variant="body2" color="text.secondary">
					Overhead is line rental and airtime for SIMs not on a mission. Devices
					on an invoice that match no glider in OGDB: {formatUsd0(unassigned)}{" "}
					in total (see Things to check).
				</Typography>
			</AccordionDetails>
		</Accordion>
	);
}
