"use client";

import AddIcon from "@mui/icons-material/Add";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useRef, useState } from "react";
import { TOOLBAR_CONTROL_HEIGHT } from "../lib/data-table";
import {
	type DateRangeFilterValue,
	type FilterDef,
	type FilterState,
	type MultiSelectFilterDef,
	type MultiSelectFilterValue,
	filterOptions,
	isFilterActive,
} from "../lib/table-filters";

export default function FilterBar<T>({
	rows,
	filters,
	value,
	onChange,
}: {
	rows: T[];
	filters: FilterDef<T>[];
	value: FilterState;
	onChange: (next: FilterState) => void;
}) {
	const [activeKeys, setActiveKeys] = useState<string[]>(() =>
		filters.filter((f) => isFilterActive(f, value[f.key])).map((f) => f.key),
	);
	const [openKey, setOpenKey] = useState<string | null>(null);
	const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
	const [addAnchorEl, setAddAnchorEl] = useState<HTMLElement | null>(null);
	const chipRefs = useRef<Record<string, HTMLElement | null>>({});

	const activeDefs = filters.filter((f) => activeKeys.includes(f.key));
	const inactiveDefs = filters.filter((f) => !activeKeys.includes(f.key));
	const openDef = filters.find((f) => f.key === openKey);

	// Anchors the popover to the chip's own DOM node rather than whatever
	// element was clicked — a newly-added chip doesn't exist yet at click
	// time (it comes from a menu item that unmounts on selection). Refs
	// commit before effects run, and openKey is only ever set to a key
	// after activeKeys already includes it, so the ref is always populated
	// by the time this runs.
	useEffect(() => {
		setAnchorEl(openKey ? (chipRefs.current[openKey] ?? null) : null);
	}, [openKey]);

	function openChip(key: string) {
		setOpenKey(key);
	}

	function closePopover() {
		setOpenKey(null);
	}

	function addFilter(def: FilterDef<T>) {
		setActiveKeys((prev) => [...prev, def.key]);
		setAddAnchorEl(null);
		setOpenKey(def.key);
	}

	function removeFilter(key: string) {
		setActiveKeys((prev) => prev.filter((k) => k !== key));
		const next = { ...value };
		delete next[key];
		onChange(next);
		if (openKey === key) closePopover();
	}

	function summarize(def: FilterDef<T>): string {
		if (def.type === "multiSelect") {
			const selected = (value[def.key] as MultiSelectFilterValue) ?? [];
			if (selected.length === 0) return "any";
			if (selected.length === 1) {
				const options = filterOptions(def, rows);
				return (
					options.find((o) => o.value === selected[0])?.label ?? selected[0]
				);
			}
			return `${selected.length} selected`;
		}
		const range = (value[def.key] as DateRangeFilterValue) ?? {
			from: "",
			to: "",
		};
		if (!range.from && !range.to) return "any";
		if (range.from && range.to) return `${range.from} – ${range.to}`;
		return range.from ? `after ${range.from}` : `before ${range.to}`;
	}

	return (
		<>
			{activeDefs.map((def) => (
				<Chip
					key={def.key}
					ref={(el) => {
						chipRefs.current[def.key] = el;
					}}
					size="small"
					variant="outlined"
					label={`${def.label}: ${summarize(def)}`}
					onClick={() => openChip(def.key)}
					onDelete={() => removeFilter(def.key)}
					sx={{ height: TOOLBAR_CONTROL_HEIGHT }}
				/>
			))}

			<Button
				size="small"
				variant="outlined"
				sx={{ height: TOOLBAR_CONTROL_HEIGHT, borderStyle: "dashed" }}
				startIcon={<AddIcon fontSize="small" />}
				onClick={(e) => setAddAnchorEl(e.currentTarget)}
				disabled={inactiveDefs.length === 0}
			>
				Add filter
			</Button>
			<Menu
				anchorEl={addAnchorEl}
				open={Boolean(addAnchorEl)}
				onClose={() => setAddAnchorEl(null)}
			>
				{inactiveDefs.map((def) => (
					<MenuItem key={def.key} onClick={() => addFilter(def)}>
						{def.label}
					</MenuItem>
				))}
			</Menu>

			{openDef && (
				<Popover
					open
					anchorEl={anchorEl}
					onClose={closePopover}
					anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
				>
					<Box sx={{ p: 2, minWidth: 220 }}>
						{openDef.type === "multiSelect" ? (
							<MultiSelectFilterEditor
								def={openDef}
								rows={rows}
								value={(value[openDef.key] as MultiSelectFilterValue) ?? []}
								onChange={(v) => onChange({ ...value, [openDef.key]: v })}
							/>
						) : (
							<DateRangeFilterEditor
								value={
									(value[openDef.key] as DateRangeFilterValue) ?? {
										from: "",
										to: "",
									}
								}
								onChange={(v) => onChange({ ...value, [openDef.key]: v })}
							/>
						)}
					</Box>
				</Popover>
			)}
		</>
	);
}

function MultiSelectFilterEditor<T>({
	def,
	rows,
	value,
	onChange,
}: {
	def: MultiSelectFilterDef<T>;
	rows: T[];
	value: MultiSelectFilterValue;
	onChange: (v: MultiSelectFilterValue) => void;
}) {
	const options = useMemo(() => filterOptions(def, rows), [def, rows]);

	function toggle(v: string) {
		onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
	}

	return (
		<Box sx={{ display: "flex", flexDirection: "column" }}>
			<Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
				{def.label}
			</Typography>
			<Box
				sx={{
					display: "flex",
					flexDirection: "column",
					maxHeight: 280,
					overflowY: "auto",
				}}
			>
				{options.length === 0 && (
					<Typography variant="body2" color="text.secondary">
						No values available
					</Typography>
				)}
				{options.map((opt) => (
					<FormControlLabel
						key={opt.value}
						control={
							<Checkbox
								size="small"
								checked={value.includes(opt.value)}
								onChange={() => toggle(opt.value)}
							/>
						}
						label={opt.label}
					/>
				))}
			</Box>
		</Box>
	);
}

function DateRangeFilterEditor({
	value,
	onChange,
}: {
	value: DateRangeFilterValue;
	onChange: (v: DateRangeFilterValue) => void;
}) {
	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
			<TextField
				label="From"
				type="date"
				size="small"
				InputLabelProps={{ shrink: true }}
				value={value.from}
				onChange={(e) => onChange({ ...value, from: e.target.value })}
			/>
			<TextField
				label="To"
				type="date"
				size="small"
				InputLabelProps={{ shrink: true }}
				value={value.to}
				onChange={(e) => onChange({ ...value, to: e.target.value })}
			/>
		</Box>
	);
}
