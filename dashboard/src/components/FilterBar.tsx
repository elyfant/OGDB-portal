"use client";

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Popover from "@mui/material/Popover";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";
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
	// Every filter is always visible as a dropdown button; clicking one
	// opens a popover anchored to it. Only one popover is open at a time.
	const [openKey, setOpenKey] = useState<string | null>(null);
	const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

	const openDef = filters.find((f) => f.key === openKey);
	const hasActiveFilters = filters.some((f) => isFilterActive(f, value[f.key]));

	function summarize(def: FilterDef<T>): string | null {
		if (!isFilterActive(def, value[def.key])) return null;
		if (def.type === "multiSelect") {
			const selected = value[def.key] as MultiSelectFilterValue;
			if (selected.length === 1) {
				const options = filterOptions(def, rows);
				return (
					options.find((o) => o.value === selected[0])?.label ?? selected[0]
				);
			}
			return `${selected.length} selected`;
		}
		const range = value[def.key] as DateRangeFilterValue;
		if (range.from && range.to) return `${range.from} – ${range.to}`;
		return range.from ? `after ${range.from}` : `before ${range.to}`;
	}

	return (
		<>
			{filters.map((def) => {
				const summary = summarize(def);
				const active = summary !== null;
				return (
					<Button
						key={def.key}
						size="small"
						variant="outlined"
						color={active ? "primary" : "inherit"}
						endIcon={<ArrowDropDownIcon />}
						onClick={(e) => {
							setAnchorEl(e.currentTarget);
							setOpenKey(def.key);
						}}
						sx={{
							height: TOOLBAR_CONTROL_HEIGHT,
							textTransform: "none",
							fontWeight: active ? 600 : 400,
						}}
					>
						{active ? `${def.label}: ${summary}` : def.label}
					</Button>
				);
			})}

			{hasActiveFilters && (
				<Button
					size="small"
					sx={{ textTransform: "none", fontSize: 12, minWidth: 0 }}
					onClick={() => onChange({})}
				>
					Clear filters
				</Button>
			)}

			{openDef && (
				<Popover
					open
					anchorEl={anchorEl}
					onClose={() => setOpenKey(null)}
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
