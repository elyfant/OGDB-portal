"use client";

import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import MuiLink from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { IridiumMissionCost, IridiumMonthlyCost } from "@ogdb/types";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
	MIN_REFERENCE_DAYS,
	PLATFORMS,
	PLATFORM_LABEL,
	type Platform,
	type Range,
	estimate,
	formatMonth,
	formatNok0,
	formatUsd0,
	overheadPerMonth,
	perDeployedMonth,
	perMonthUsd,
	referenceMissions,
} from "../../lib/iridium";

type RefCount = 5 | 10 | "all";

function RangeLine({ r }: { r: Range }) {
	return (
		<Typography variant="body2" color="text.secondary">
			range {formatUsd0(r.min)} to {formatUsd0(r.max)}
		</Typography>
	);
}

function PlatformCard({
	platform,
	refs,
	usdNok,
}: {
	platform: Platform;
	refs: IridiumMissionCost[];
	usdNok: number | null;
}) {
	const perMonth = perDeployedMonth(refs);
	return (
		<Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
			<Typography variant="overline" color="text.secondary">
				{PLATFORM_LABEL[platform]} · per deployed month
			</Typography>
			{perMonth ? (
				<>
					<Typography variant="h4" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
						{formatUsd0(perMonth.median)}
					</Typography>
					<Typography variant="body2" color="text.secondary">
						median · ≈ {formatNok0(perMonth.median, usdNok)}
					</Typography>
					<RangeLine r={perMonth} />
					<Divider sx={{ my: 1.5 }} />
					<Typography variant="caption" color="text.secondary">
						Based on these {refs.length} missions:
					</Typography>
					{refs.map((m) => (
						<Box
							key={m.missionId}
							sx={{
								display: "flex",
								justifyContent: "space-between",
								gap: 1,
								py: 0.25,
							}}
						>
							<MuiLink
								component={Link}
								href={`/missions/${m.missionId}`}
								variant="body2"
								underline="hover"
								noWrap
							>
								{m.stdMissionName}
							</MuiLink>
							<Typography variant="body2" color="text.secondary" noWrap>
								{Math.round(m.durationDays)} d · {formatUsd0(perMonthUsd(m))}
								/mo
							</Typography>
						</Box>
					))}
				</>
			) : (
				<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
					No recovered, fully invoiced {PLATFORM_LABEL[platform]} missions yet.
				</Typography>
			)}
		</Paper>
	);
}

export default function DeploymentCosts({
	missions,
	monthly,
	usdNok,
}: {
	missions: IridiumMissionCost[];
	monthly: IridiumMonthlyCost[];
	usdNok: number | null;
}) {
	const [refCount, setRefCount] = useState<RefCount>(5);
	const [platform, setPlatform] = useState<Platform>("seaglider");
	const [days, setDays] = useState("90");

	const count = refCount === "all" ? null : refCount;
	const refs = useMemo(
		() =>
			Object.fromEntries(
				PLATFORMS.map((p) => [p, referenceMissions(missions, p, count)]),
			) as Record<Platform, IridiumMissionCost[]>,
		[missions, count],
	);
	const overhead = useMemo(() => overheadPerMonth(monthly), [monthly]);
	const nDays = Number(days);
	const est =
		Number.isFinite(nDays) && nDays > 0
			? estimate(refs[platform], nDays, overhead?.usd ?? 0)
			: null;

	return (
		<Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
			<Box
				sx={{
					display: "flex",
					flexWrap: "wrap",
					alignItems: "center",
					justifyContent: "space-between",
					gap: 2,
					mb: 2,
				}}
			>
				<Typography variant="h6">What does a deployment cost?</Typography>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					<Typography variant="body2" color="text.secondary">
						Based on the last
					</Typography>
					<ToggleButtonGroup
						size="small"
						exclusive
						value={refCount}
						onChange={(_, v: RefCount | null) => v && setRefCount(v)}
					>
						<ToggleButton value={5}>5</ToggleButton>
						<ToggleButton value={10}>10</ToggleButton>
						<ToggleButton value="all">All</ToggleButton>
					</ToggleButtonGroup>
					<Typography variant="body2" color="text.secondary">
						missions per platform
					</Typography>
				</Box>
			</Box>

			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: {
						xs: "1fr",
						md: "1fr 1fr",
						lg: "1fr 1fr 1.2fr",
					},
					gap: 2,
					alignItems: "start",
				}}
			>
				{PLATFORMS.map((p) => (
					<PlatformCard key={p} platform={p} refs={refs[p]} usdNok={usdNok} />
				))}

				<Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
					<Typography variant="overline" color="text.secondary">
						Estimate a mission
					</Typography>
					<Box sx={{ display: "flex", gap: 1.5, my: 1.5 }}>
						<TextField
							select
							size="small"
							label="Platform"
							value={platform}
							onChange={(e) => setPlatform(e.target.value as Platform)}
							sx={{ flex: 1 }}
						>
							{PLATFORMS.map((p) => (
								<MenuItem key={p} value={p}>
									{PLATFORM_LABEL[p]}
								</MenuItem>
							))}
						</TextField>
						<TextField
							size="small"
							label="Days in the water"
							type="number"
							value={days}
							onChange={(e) => setDays(e.target.value)}
							error={!(nDays > 0)}
							helperText={nDays > 0 ? undefined : "Enter a number of days"}
							slotProps={{ htmlInput: { min: 1, step: 1 } }}
							sx={{ flex: 1 }}
						/>
					</Box>
					{est ? (
						<>
							<EstimateRow
								label="Mission + pre-launch testing"
								r={est.raw}
								usdNok={usdNok}
							/>
							<EstimateRow
								label={`Including fleet overhead (+${formatUsd0(est.overheadUsd)} for ${est.months} month${est.months === 1 ? "" : "s"})`}
								r={est.withOverhead}
								usdNok={usdNok}
							/>
							<Typography
								variant="caption"
								color="text.secondary"
								component="p"
								sx={{ mt: 1.5 }}
							>
								Each of the {refs[platform].length} reference missions' in-water
								cost per day × {Math.round(nDays)} days, plus its own pre-launch
								testing: the median, and the range across them.
								{overhead &&
									` Overhead is the fleet's idle SIM rental and idle airtime, ${formatUsd0(overhead.usd)}/month on average over ${formatMonth(overhead.from)}–${formatMonth(overhead.to)}, for the mission's length rounded up to whole months.`}{" "}
								Missions under {MIN_REFERENCE_DAYS} days or with un-invoiced
								months are left out. NOK at the latest month's rate.
							</Typography>
						</>
					) : (
						nDays > 0 && (
							<Typography variant="body2" color="text.secondary">
								No reference missions for {PLATFORM_LABEL[platform]} yet.
							</Typography>
						)
					)}
				</Paper>
			</Box>
		</Paper>
	);
}

function EstimateRow({
	label,
	r,
	usdNok,
}: {
	label: string;
	r: Range;
	usdNok: number | null;
}) {
	return (
		<Box sx={{ py: 1, borderTop: 1, borderColor: "divider" }}>
			<Typography variant="body2" color="text.secondary">
				{label}
			</Typography>
			<Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5 }}>
				<Typography variant="h5" sx={{ fontWeight: 600 }}>
					≈ {formatUsd0(r.median)}
				</Typography>
				<Typography variant="body2" color="text.secondary">
					{formatNok0(r.median, usdNok)} · range {formatUsd0(r.min)} to{" "}
					{formatUsd0(r.max)}
				</Typography>
			</Box>
		</Box>
	);
}
