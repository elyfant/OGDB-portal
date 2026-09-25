"use client";

import {
	EMPTY_MISSION_MAP_FILTERS,
	type MissionMapFilters,
	distinctValues,
	hasActiveFilters,
	missionMapLabel,
	trackColor,
} from "@/lib/mission-map-filters";
import CloseIcon from "@mui/icons-material/Close";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RouteIcon from "@mui/icons-material/Route";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { MissionMapEntry } from "@ogdb/types";
import { type ReactNode, useMemo, useState } from "react";

type PickKey = "sites" | "projects" | "gliders";

function FilterSection({
	title,
	activeCount,
	children,
}: {
	title: string;
	activeCount: number;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(false);
	return (
		<Box sx={{ borderTop: 1, borderColor: "divider" }}>
			<Box
				component="button"
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-expanded={open}
				sx={{
					width: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					px: 1.5,
					py: 0.75,
					border: 0,
					background: "none",
					color: "text.primary",
					cursor: "pointer",
					font: "inherit",
				}}
			>
				<Typography variant="body2">
					{title}
					{activeCount > 0 && (
						<Typography
							component="span"
							variant="body2"
							color="primary"
							sx={{ ml: 0.75 }}
						>
							({activeCount})
						</Typography>
					)}
				</Typography>
				{open ? (
					<ExpandLessIcon fontSize="small" />
				) : (
					<ExpandMoreIcon fontSize="small" />
				)}
			</Box>
			<Collapse in={open}>
				<Box sx={{ px: 1.5, pb: 1 }}>{children}</Box>
			</Collapse>
		</Box>
	);
}

function PickChips({
	options,
	picked,
	onToggle,
}: {
	options: string[];
	picked: string[];
	onToggle: (value: string) => void;
}) {
	if (options.length === 0) {
		return (
			<Typography variant="caption" color="text.secondary">
				None recorded on any mission.
			</Typography>
		);
	}
	return (
		<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
			{options.map((o) => {
				const selected = picked.includes(o);
				return (
					<Chip
						key={o}
						label={o}
						size="small"
						clickable
						color={selected ? "primary" : "default"}
						variant={selected ? "filled" : "outlined"}
						onClick={() => onToggle(o)}
					/>
				);
			})}
		</Box>
	);
}

export default function FleetMapPanel({
	missions,
	filtered,
	filters,
	onFiltersChange,
	hiddenIds,
	onHiddenIdsChange,
	onClose,
}: {
	missions: MissionMapEntry[];
	filtered: MissionMapEntry[];
	filters: MissionMapFilters;
	onFiltersChange: (f: MissionMapFilters) => void;
	hiddenIds: Set<number>;
	onHiddenIdsChange: (ids: Set<number>) => void;
	onClose: () => void;
}) {
	const options = useMemo(
		() => ({
			sites: distinctValues(missions, "site"),
			projects: distinctValues(missions, "project"),
			gliders: distinctValues(missions, "glider"),
		}),
		[missions],
	);

	// Only missions with a track can actually be switched on or off --
	// the rest are listed (so it's visible which ones still need a
	// backfill) but greyed out and left out of the "all" toggle's maths.
	const toggleable = filtered.filter((m) => m.track.length > 0);
	const onCount = toggleable.filter((m) => !hiddenIds.has(m.id)).length;
	const allOn = toggleable.length > 0 && onCount === toggleable.length;
	const someOn = onCount > 0 && !allOn;

	function togglePick(key: PickKey, value: string) {
		const current = filters[key];
		onFiltersChange({
			...filters,
			[key]: current.includes(value)
				? current.filter((v) => v !== value)
				: [...current, value],
		});
	}

	// Applies to the missions the filters currently list, not the whole
	// fleet -- "filter to one glider, then switch all off" shouldn't also
	// flip missions the user can't see in the list.
	function toggleAll() {
		const next = new Set(hiddenIds);
		for (const m of toggleable) {
			if (allOn) next.add(m.id);
			else next.delete(m.id);
		}
		onHiddenIdsChange(next);
	}

	function toggleOne(id: number) {
		const next = new Set(hiddenIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		onHiddenIdsChange(next);
	}

	return (
		<Paper
			elevation={4}
			sx={{
				position: "absolute",
				top: 64,
				right: 10,
				zIndex: 1000,
				width: 320,
				maxWidth: "calc(100% - 20px)",
				maxHeight: "calc(100% - 84px)",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}
		>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 1,
					px: 1.5,
					py: 1,
				}}
			>
				<RouteIcon fontSize="small" />
				<Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
					Missions
				</Typography>
				<Typography variant="caption" color="text.secondary">
					{onCount} of {toggleable.length} shown
				</Typography>
				<IconButton size="small" onClick={onClose} aria-label="Close panel">
					<CloseIcon fontSize="small" />
				</IconButton>
			</Box>
			<Divider />
			<Box sx={{ px: 1.5, py: 0.5 }}>
				<FormControlLabel
					control={
						<Checkbox
							size="small"
							checked={allOn}
							indeterminate={someOn}
							onChange={toggleAll}
							disabled={toggleable.length === 0}
						/>
					}
					label={<Typography variant="body2">All missions</Typography>}
				/>
			</Box>

			<Box sx={{ overflowY: "auto" }}>
				<FilterSection title="Sites" activeCount={filters.sites.length}>
					<PickChips
						options={options.sites}
						picked={filters.sites}
						onToggle={(v) => togglePick("sites", v)}
					/>
				</FilterSection>
				<FilterSection title="Projects" activeCount={filters.projects.length}>
					<PickChips
						options={options.projects}
						picked={filters.projects}
						onToggle={(v) => togglePick("projects", v)}
					/>
				</FilterSection>
				<FilterSection title="Gliders" activeCount={filters.gliders.length}>
					<PickChips
						options={options.gliders}
						picked={filters.gliders}
						onToggle={(v) => togglePick("gliders", v)}
					/>
				</FilterSection>
				<FilterSection
					title="Dates"
					activeCount={(filters.from ? 1 : 0) + (filters.to ? 1 : 0)}
				>
					<Box sx={{ display: "flex", gap: 1 }}>
						<TextField
							label="From"
							type="date"
							size="small"
							value={filters.from}
							onChange={(e) =>
								onFiltersChange({ ...filters, from: e.target.value })
							}
							InputLabelProps={{ shrink: true }}
							fullWidth
						/>
						<TextField
							label="To"
							type="date"
							size="small"
							value={filters.to}
							onChange={(e) =>
								onFiltersChange({ ...filters, to: e.target.value })
							}
							InputLabelProps={{ shrink: true }}
							fullWidth
						/>
					</Box>
					<Typography
						variant="caption"
						color="text.secondary"
						sx={{ display: "block", mt: 0.5 }}
					>
						Includes any mission in the water at some point in this range.
					</Typography>
				</FilterSection>
				{hasActiveFilters(filters) && (
					<Box sx={{ px: 1.5, pb: 1 }}>
						<Button
							size="small"
							onClick={() => onFiltersChange(EMPTY_MISSION_MAP_FILTERS)}
						>
							Clear filters
						</Button>
					</Box>
				)}

				<Divider />
				<Box sx={{ py: 0.5 }}>
					{filtered.length === 0 && (
						<Typography
							variant="body2"
							color="text.secondary"
							sx={{ px: 1.5, py: 1 }}
						>
							No missions match these filters.
						</Typography>
					)}
					{filtered.map((m) => {
						const hasTrack = m.track.length > 0;
						return (
							<Box
								key={m.id}
								component="label"
								sx={{
									display: "flex",
									alignItems: "center",
									gap: 0.75,
									px: 1,
									cursor: hasTrack ? "pointer" : "default",
									"&:hover": hasTrack ? { bgcolor: "action.hover" } : {},
								}}
							>
								<Checkbox
									size="small"
									checked={hasTrack && !hiddenIds.has(m.id)}
									disabled={!hasTrack}
									onChange={() => toggleOne(m.id)}
									sx={{ p: 0.5 }}
								/>
								<Box
									sx={{
										width: 14,
										height: 4,
										borderRadius: 1,
										flexShrink: 0,
										bgcolor: hasTrack ? trackColor(m.id) : "action.disabled",
									}}
								/>
								<Box sx={{ minWidth: 0 }}>
									<Typography
										variant="body2"
										noWrap
										color={hasTrack ? "text.primary" : "text.disabled"}
									>
										{missionMapLabel(m)}
									</Typography>
									<Typography
										variant="caption"
										color="text.secondary"
										noWrap
										component="div"
									>
										{m.glider ?? "Unknown glider"}
										{hasTrack ? "" : " · no track yet"}
									</Typography>
								</Box>
							</Box>
						);
					})}
				</Box>
			</Box>
		</Paper>
	);
}
