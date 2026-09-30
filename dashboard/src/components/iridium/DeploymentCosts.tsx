"use client";

import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { IridiumGliderMonth, IridiumMissionCost } from "@ogdb/types";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
	MIN_REFERENCE_DAYS,
	type Overhead,
	PLATFORMS,
	PLATFORM_LABEL,
	type Platform,
	type Range,
	estimate,
	formatMonth,
	formatNok0,
	formatUsd0,
	overheadPerGlider,
	perDeployedMonth,
	perMonthUsd,
	referenceMissions,
} from "../../lib/iridium";

type RefCount = 5 | 10 | "all";

function MissionRow({
	mission,
	selected,
	overheadUsd,
	onToggle,
}: {
	mission: IridiumMissionCost;
	selected: boolean;
	overheadUsd: number;
	onToggle: () => void;
}) {
	const color = selected ? "text.primary" : "text.disabled";
	return (
		<Box
			onClick={onToggle}
			sx={{
				display: "flex",
				alignItems: "center",
				gap: 0.5,
				mx: -1,
				px: 0.5,
				borderRadius: 1,
				cursor: "pointer",
				"&:hover": { bgcolor: "action.hover" },
			}}
		>
			<Checkbox
				size="small"
				checked={selected}
				onClick={(e) => e.stopPropagation()}
				onChange={onToggle}
				sx={{ p: 0.5 }}
				slotProps={{
					input: {
						"aria-label": `Use ${mission.stdMissionName} in the estimate`,
					},
				}}
			/>
			<Typography
				variant="body2"
				noWrap
				sx={{
					flex: 1,
					color,
					textDecoration: selected ? "none" : "line-through",
				}}
			>
				{mission.stdMissionName}
			</Typography>
			<Typography
				variant="body2"
				noWrap
				sx={{ color: selected ? "text.secondary" : "text.disabled" }}
			>
				{Math.round(mission.durationDays)} d ·{" "}
				{formatUsd0(perMonthUsd(mission, overheadUsd))}/mo
			</Typography>
			<Tooltip title="Open mission">
				<IconButton
					size="small"
					component={Link}
					href={`/missions/${mission.missionId}`}
					onClick={(e: React.MouseEvent) => e.stopPropagation()}
					aria-label={`Open ${mission.stdMissionName}`}
				>
					<OpenInNewIcon sx={{ fontSize: 16 }} />
				</IconButton>
			</Tooltip>
		</Box>
	);
}

function PlatformCard({
	platform,
	refs,
	excluded,
	onToggle,
	overhead,
	usdNok,
}: {
	platform: Platform;
	refs: IridiumMissionCost[];
	excluded: Set<number>;
	onToggle: (missionId: number) => void;
	overhead: Overhead | null;
	usdNok: number | null;
}) {
	const overheadUsd = overhead?.usd ?? 0;
	const used = refs.filter((m) => !excluded.has(m.missionId));
	const perMonth = perDeployedMonth(used, overheadUsd);
	return (
		<Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
			<Typography variant="overline" color="text.secondary">
				{PLATFORM_LABEL[platform]} · per deployed month*
			</Typography>
			{refs.length === 0 ? (
				<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
					No recovered, fully invoiced {PLATFORM_LABEL[platform]} missions yet.
				</Typography>
			) : (
				<>
					{perMonth ? (
						<>
							<Typography
								variant="h4"
								sx={{ fontWeight: 600, lineHeight: 1.2 }}
							>
								{formatUsd0(perMonth.median)}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								median · ≈ {formatNok0(perMonth.median, usdNok)} · range{" "}
								{formatUsd0(perMonth.min)} to {formatUsd0(perMonth.max)}
							</Typography>
						</>
					) : (
						<Typography variant="body2" color="warning.main" sx={{ my: 1 }}>
							Select at least one mission.
						</Typography>
					)}
					<Divider sx={{ my: 1.5 }} />
					<Typography variant="caption" color="text.secondary">
						Using {used.length} of {refs.length} missions. Click one to leave it
						out.
					</Typography>
					{refs.map((m) => (
						<MissionRow
							key={m.missionId}
							mission={m}
							selected={!excluded.has(m.missionId)}
							overheadUsd={overheadUsd}
							onToggle={() => onToggle(m.missionId)}
						/>
					))}
					<Typography
						variant="caption"
						color="text.secondary"
						component="p"
						sx={{ mt: 1 }}
					>
						* Airtime and line rental while deployed, plus the mission's
						pre-launch testing spread over its days in the water, plus one{" "}
						{PLATFORM_LABEL[platform]}'s overhead
						{overhead ? ` (${formatUsd0(overhead.usd)}/month)` : ""}.
					</Typography>
				</>
			)}
		</Paper>
	);
}

export default function DeploymentCosts({
	missions,
	gliderMonths,
	usdNok,
}: {
	missions: IridiumMissionCost[];
	gliderMonths: IridiumGliderMonth[];
	usdNok: number | null;
}) {
	const [refCount, setRefCount] = useState<RefCount>(5);
	const [platform, setPlatform] = useState<Platform>("seaglider");
	const [days, setDays] = useState("90");
	// Missions the user has clicked out. Kept across 5/10/All switches, so
	// widening the list doesn't bring back a mission they rejected.
	const [excluded, setExcluded] = useState<Set<number>>(new Set());

	const count = refCount === "all" ? null : refCount;
	const refs = useMemo(
		() =>
			Object.fromEntries(
				PLATFORMS.map((p) => [p, referenceMissions(missions, p, count)]),
			) as Record<Platform, IridiumMissionCost[]>,
		[missions, count],
	);
	const overhead = useMemo(
		() =>
			Object.fromEntries(
				PLATFORMS.map((p) => [p, overheadPerGlider(gliderMonths, p)]),
			) as Record<Platform, Overhead | null>,
		[gliderMonths],
	);

	function toggle(missionId: number) {
		setExcluded((prev) => {
			const next = new Set(prev);
			if (!next.delete(missionId)) next.add(missionId);
			return next;
		});
	}

	const used = refs[platform].filter((m) => !excluded.has(m.missionId));
	const nDays = Number(days);
	const est =
		Number.isFinite(nDays) && nDays > 0
			? estimate(used, nDays, overhead[platform]?.usd ?? 0)
			: null;
	const oh = overhead[platform];

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
					<PlatformCard
						key={p}
						platform={p}
						refs={refs[p]}
						excluded={excluded}
						onToggle={toggle}
						overhead={overhead[p]}
						usdNok={usdNok}
					/>
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
								label="Mission"
								r={est.withOverhead}
								usdNok={usdNok}
							/>
							<Typography
								variant="caption"
								color="text.secondary"
								component="p"
								sx={{ mt: 1.5 }}
							>
								Each selected mission's in-water cost per day ×{" "}
								{Math.round(nDays)} days, plus its own pre-launch testing, plus
								overhead ({formatUsd0(oh?.usd ?? 0)}/month × {est.months} month
								{est.months === 1 ? "" : "s"} = {formatUsd0(est.overheadUsd)}):
								the median, and the range across the {used.length} selected{" "}
								{PLATFORM_LABEL[platform]} missions.
								{oh &&
									` Overhead is a ${PLATFORM_LABEL[platform]}'s line rental and airtime not charged to any mission, ${formatUsd0(oh.usd)}/month on average across ${oh.gliders} gliders over ${formatMonth(oh.from)}–${formatMonth(oh.to)}, for the mission's length rounded up to whole months.`}{" "}
								Missions under {MIN_REFERENCE_DAYS} days or with un-invoiced
								months are never used. NOK at the latest month's rate.
							</Typography>
						</>
					) : (
						nDays > 0 && (
							<Typography variant="body2" color="text.secondary">
								{refs[platform].length === 0
									? `No reference missions for ${PLATFORM_LABEL[platform]} yet.`
									: `Select at least one ${PLATFORM_LABEL[platform]} mission.`}
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
