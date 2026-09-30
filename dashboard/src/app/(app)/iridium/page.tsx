import DeploymentCosts from "@/components/iridium/DeploymentCosts";
import FleetOverview from "@/components/iridium/FleetOverview";
import GliderLatestMonth from "@/components/iridium/GliderLatestMonth";
import IridiumMissionsTable from "@/components/iridium/IridiumMissionsTable";
import ThingsToCheck from "@/components/iridium/ThingsToCheck";
import {
	getIridiumGliderMonths,
	getIridiumMissions,
	getIridiumMonthly,
	getIridiumSummary,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { formatMonth, formatNok0, formatUsd0 } from "@/lib/iridium";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default async function IridiumPage() {
	const [summary, missions, monthly, gliderMonths] = await Promise.all([
		getIridiumSummary(),
		getIridiumMissions(),
		getIridiumMonthly(),
		getIridiumGliderMonths(),
	]);
	const run = summary.lastRun;

	if (!run?.lastMonth) {
		return (
			<Box>
				<Typography variant="h5" sx={{ mb: 2 }}>
					Iridium
				</Typography>
				<Typography color="text.secondary">
					No invoices imported yet. Run iridium-costs push to fill this page.
				</Typography>
			</Box>
		);
	}

	const usdNok = summary.latestRate?.usdNok ?? null;

	return (
		<Box>
			<Box
				sx={{
					display: "flex",
					flexWrap: "wrap",
					alignItems: "baseline",
					justifyContent: "space-between",
					gap: 1,
					mb: 2,
				}}
			>
				<Typography variant="h5">Iridium</Typography>
				<Typography variant="body2" color="text.secondary">
					Metocean invoices {run.firstMonth ? formatMonth(run.firstMonth) : "?"}{" "}
					to {formatMonth(run.lastMonth)} · {formatUsd0(run.totalUsd)} (≈{" "}
					{summary.totalNok === null
						? "—"
						: `kr ${Math.round(summary.totalNok).toLocaleString("nb-NO")}`}
					) · updated {formatDateTime(run.runAt)}
				</Typography>
			</Box>

			<ThingsToCheck warnings={run.warnings} />
			<DeploymentCosts missions={missions} monthly={monthly} usdNok={usdNok} />
			<GliderLatestMonth rows={gliderMonths} lastMonth={run.lastMonth} />
			<IridiumMissionsTable missions={missions} />
			<FleetOverview monthly={monthly} />

			<Typography
				variant="caption"
				color="text.secondary"
				component="p"
				sx={{ mt: 2 }}
			>
				USD as billed by Metocean. NOK is an estimate at Norges Bank's monthly
				average rate
				{summary.latestRate
					? ` (${formatMonth(summary.latestRate.month)}: ${summary.latestRate.usdNok.toFixed(2)}; estimates use this rate, e.g. $1,000 ≈ ${formatNok0(1000, usdNok)})`
					: ""}
				, not what UiB paid.
			</Typography>
		</Box>
	);
}
