"use client";

import DataTable from "@/components/DataTable";
import type { ColumnDef } from "@/lib/data-table";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { IridiumMissionCost } from "@ogdb/types";
import { useState } from "react";
import { AVG_MONTH_DAYS, PLATFORM_LABEL, formatUsd0 } from "../../lib/iridium";
import { useIridiumColors } from "./colors";

// Same threshold iridium-costs uses for its "Things to check" list.
const PRE_LAUNCH_FLAG_USD = 50;

type Row = IridiumMissionCost & { usdPerMonth: number | null };

const usd = (v: unknown) => formatUsd0(v as number | null);

function CostBar({ row }: { row: Row }) {
	const c = useIridiumColors();
	const parts = [
		[row.beforeLaunchUsd, c.beforeLaunch, "Before launch"],
		[row.missionUsageUsd, c.missionUsage, "Usage"],
		[row.missionRentalUsd, c.missionRental, "Line rental"],
		[row.afterRecoveryUsd, c.afterRecovery, "After recovery"],
	] as const;
	return (
		<Box
			sx={{
				display: "flex",
				alignItems: "center",
				gap: 1,
				justifyContent: "flex-end",
			}}
		>
			<span>{formatUsd0(row.totalUsd)}</span>
			<Tooltip
				title={parts
					.filter(([v]) => v > 0)
					.map(([v, , label]) => `${label} ${formatUsd0(v)}`)
					.join(" · ")}
			>
				<Box
					sx={{
						display: "flex",
						width: 60,
						height: 8,
						borderRadius: 0.5,
						overflow: "hidden",
						bgcolor: "action.hover",
					}}
				>
					{row.totalUsd > 0 &&
						parts.map(([v, color, label]) => (
							<Box
								key={label}
								sx={{ width: `${(v / row.totalUsd) * 100}%`, bgcolor: color }}
							/>
						))}
				</Box>
			</Tooltip>
		</Box>
	);
}

function MissionName({ row }: { row: Row }) {
	return (
		<Box
			sx={{
				display: "flex",
				alignItems: "center",
				gap: 0.75,
				flexWrap: "wrap",
			}}
		>
			<span>{row.stdMissionName}</span>
			{!row.fullyInvoiced && (
				<Tooltip
					title={`Invoices cover ${row.invoicedMonths} of ${row.missionMonths} months, so the total is too low`}
				>
					<Typography
						component="span"
						color="warning.main"
						sx={{ fontWeight: 600 }}
					>
						†
					</Typography>
				</Tooltip>
			)}
			{row.beforeLaunchUsd >= PRE_LAUNCH_FLAG_USD && (
				<Tooltip
					title={`Pre-launch airtime in ${row.preLaunchMonths.join(", ")}: long testing, or a wrong launch date?`}
				>
					<Chip
						size="small"
						color="warning"
						variant="outlined"
						label="pre-launch"
					/>
				</Tooltip>
			)}
			{row.leftOnMonths.length > 0 && (
				<Tooltip
					title={`Airtime after recovery in ${row.leftOnMonths.join(", ")}: glider left on, or a wrong recovery date?`}
				>
					<Chip
						size="small"
						color="warning"
						variant="outlined"
						label="left on"
					/>
				</Tooltip>
			)}
		</Box>
	);
}

const COLUMNS: ColumnDef<Row>[] = [
	{
		key: "stdMissionName",
		label: "Mission",
		kind: "string",
		defaultVisible: true,
		renderCell: (r) => <MissionName row={r} />,
	},
	{ key: "gliderName", label: "Glider", kind: "string", defaultVisible: true },
	{
		key: "platform",
		label: "Platform",
		kind: "string",
		defaultVisible: false,
		format: (v) => PLATFORM_LABEL[v as string] ?? String(v ?? "—"),
	},
	{ key: "launchDate", label: "Launch", kind: "date", defaultVisible: true },
	{
		key: "recoveryDate",
		label: "Recovery",
		kind: "date",
		defaultVisible: false,
	},
	{
		key: "durationDays",
		label: "Days",
		kind: "number",
		defaultVisible: true,
		align: "right",
		format: (v) => String(Math.round(v as number)),
	},
	{
		key: "totalUsd",
		label: "Total",
		kind: "number",
		defaultVisible: true,
		align: "right",
		format: usd,
		renderCell: (r) => <CostBar row={r} />,
	},
	{
		key: "totalNok",
		label: "Total (NOK)",
		kind: "number",
		defaultVisible: false,
		align: "right",
		format: (v) =>
			v == null ? "—" : `kr ${Math.round(v as number).toLocaleString("nb-NO")}`,
	},
	{
		key: "usdPerDay",
		label: "$/day",
		kind: "number",
		defaultVisible: true,
		align: "right",
		format: usd,
	},
	{
		key: "usdPerMonth",
		label: "$/month",
		kind: "number",
		defaultVisible: true,
		align: "right",
		format: usd,
	},
	{
		key: "missionUsageUsd",
		label: "Usage",
		kind: "number",
		defaultVisible: false,
		align: "right",
		format: usd,
	},
	{
		key: "missionRentalUsd",
		label: "Line rental",
		kind: "number",
		defaultVisible: false,
		align: "right",
		format: usd,
	},
	{
		key: "beforeLaunchUsd",
		label: "Before launch",
		kind: "number",
		defaultVisible: false,
		align: "right",
		format: usd,
	},
	{
		key: "afterRecoveryUsd",
		label: "After recovery",
		kind: "number",
		defaultVisible: false,
		align: "right",
		format: usd,
	},
];

export default function IridiumMissionsTable({
	missions,
}: {
	missions: IridiumMissionCost[];
}) {
	const [platform, setPlatform] = useState<"all" | "seaglider" | "slocum">(
		"all",
	);

	// Missions with no invoiced month at all (before the record, or a glider
	// whose SIM isn't in OGDB) have nothing to show.
	const rows: Row[] = missions
		.filter((m) => m.invoicedMonths > 0)
		.filter((m) => platform === "all" || m.platform === platform)
		.map((m) => ({
			...m,
			usdPerMonth: m.usdPerDay === null ? null : m.usdPerDay * AVG_MONTH_DAYS,
		}));

	return (
		<Box sx={{ mb: 3 }}>
			<Typography variant="h6" sx={{ mb: 1.5 }}>
				Cost per mission
			</Typography>
			<DataTable<Row>
				rows={rows}
				columns={COLUMNS}
				getRowId={(r) => r.missionId}
				getRowHref={(r) => `/missions/${r.missionId}`}
				defaultSort={{ key: "launchDate", direction: "desc" }}
				csvFileNameBase="iridium-mission-costs"
				toolbarLeft={
					<ToggleButtonGroup
						size="small"
						exclusive
						value={platform}
						onChange={(_, v) => v && setPlatform(v)}
					>
						<ToggleButton value="all">All</ToggleButton>
						<ToggleButton value="seaglider">Seaglider</ToggleButton>
						<ToggleButton value="slocum">Slocum</ToggleButton>
					</ToggleButtonGroup>
				}
				toolbarRight={
					<Typography variant="body2" color="text.secondary">
						{rows.length} missions · † = not every month invoiced
					</Typography>
				}
			/>
		</Box>
	);
}
