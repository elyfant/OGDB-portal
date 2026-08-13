"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { Mission } from "@ogdb/types";
import { useMemo, useState } from "react";
import {
	DEFAULT_VISIBLE_COLUMNS,
	MISSION_COLUMNS,
	type MissionColumnKind,
	formatMissionValue,
} from "../lib/mission-columns";
import ClickableTableRow from "./ClickableTableRow";

function rowSx(status: string | null) {
	if (status === "active")
		return { backgroundColor: "rgba(76, 175, 80, 0.16)" };
	if (status === "scheduled")
		return { backgroundColor: "rgba(255, 152, 0, 0.16)" };
	return undefined;
}

function compareValues(
	a: Mission[keyof Mission],
	b: Mission[keyof Mission],
	kind: MissionColumnKind,
	direction: "asc" | "desc",
): number {
	if (a === null || a === undefined)
		return b === null || b === undefined ? 0 : 1;
	if (b === null || b === undefined) return -1;

	let cmp: number;
	if (kind === "number") {
		cmp = (a as number) - (b as number);
	} else if (kind === "date") {
		cmp = new Date(a as string).getTime() - new Date(b as string).getTime();
	} else {
		cmp = String(a).localeCompare(String(b));
	}
	return direction === "asc" ? cmp : -cmp;
}

function uniqueSorted(values: (string | null)[]): string[] {
	return Array.from(new Set(values.filter((v): v is string => !!v))).sort(
		(a, b) => a.localeCompare(b),
	);
}

export default function MissionsTable({ missions }: { missions: Mission[] }) {
	const [visibleColumns, setVisibleColumns] = useState<(keyof Mission)[]>(
		DEFAULT_VISIBLE_COLUMNS,
	);
	const [site, setSite] = useState("");
	const [project, setProject] = useState("");
	const [dateFrom, setDateFrom] = useState("");
	const [dateTo, setDateTo] = useState("");
	const [sort, setSort] = useState<{
		key: keyof Mission;
		direction: "asc" | "desc";
	}>({ key: "launchDate", direction: "desc" });

	const siteOptions = useMemo(
		() => uniqueSorted(missions.map((m) => m.site)),
		[missions],
	);
	const projectOptions = useMemo(
		() => uniqueSorted(missions.map((m) => m.project)),
		[missions],
	);

	const filteredRows = useMemo(() => {
		return missions.filter((m) => {
			if (site && m.site !== site) return false;
			if (project && m.project !== project) return false;
			const launchDay = m.launchDate?.slice(0, 10);
			if (dateFrom && (!launchDay || launchDay < dateFrom)) return false;
			if (dateTo && (!launchDay || launchDay > dateTo)) return false;
			return true;
		});
	}, [missions, site, project, dateFrom, dateTo]);

	const sortColumn = MISSION_COLUMNS.find((c) => c.key === sort.key);

	const sortedRows = useMemo(() => {
		if (!sortColumn) return filteredRows;
		return [...filteredRows].sort((a, b) =>
			compareValues(a[sort.key], b[sort.key], sortColumn.kind, sort.direction),
		);
	}, [filteredRows, sort, sortColumn]);

	const visibleColumnDefs = MISSION_COLUMNS.filter((c) =>
		visibleColumns.includes(c.key),
	);

	function handleSort(key: keyof Mission) {
		setSort((prev) =>
			prev.key === key
				? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
				: { key, direction: "asc" },
		);
	}

	function handleColumnsChange(event: SelectChangeEvent<(keyof Mission)[]>) {
		const value = event.target.value;
		setVisibleColumns(
			typeof value === "string"
				? (value.split(",") as (keyof Mission)[])
				: value,
		);
	}

	function resetFilters() {
		setSite("");
		setProject("");
		setDateFrom("");
		setDateTo("");
	}

	return (
		<Box>
			<Box
				sx={{
					display: "flex",
					flexWrap: "wrap",
					alignItems: "center",
					gap: 2,
					mb: 2,
				}}
			>
				<Select
					multiple
					size="small"
					value={visibleColumns}
					onChange={handleColumnsChange}
					renderValue={(selected) => `${selected.length} columns`}
					sx={{ minWidth: 160 }}
				>
					{MISSION_COLUMNS.map((col) => (
						<MenuItem key={col.key} value={col.key}>
							<Checkbox
								checked={visibleColumns.includes(col.key)}
								size="small"
							/>
							<ListItemText primary={col.label} />
						</MenuItem>
					))}
				</Select>

				<Select
					size="small"
					value={site}
					onChange={(e) => setSite(e.target.value)}
					displayEmpty
					sx={{ minWidth: 140 }}
				>
					<MenuItem value="">All sites</MenuItem>
					{siteOptions.map((s) => (
						<MenuItem key={s} value={s}>
							{s}
						</MenuItem>
					))}
				</Select>

				<Select
					size="small"
					value={project}
					onChange={(e) => setProject(e.target.value)}
					displayEmpty
					sx={{ minWidth: 140 }}
				>
					<MenuItem value="">All projects</MenuItem>
					{projectOptions.map((p) => (
						<MenuItem key={p} value={p}>
							{p}
						</MenuItem>
					))}
				</Select>

				<TextField
					label="Launch after"
					type="date"
					size="small"
					InputLabelProps={{ shrink: true }}
					value={dateFrom}
					onChange={(e) => setDateFrom(e.target.value)}
				/>
				<TextField
					label="Launch before"
					type="date"
					size="small"
					InputLabelProps={{ shrink: true }}
					value={dateTo}
					onChange={(e) => setDateTo(e.target.value)}
				/>

				<Button size="small" onClick={resetFilters}>
					Reset filters
				</Button>

				<Typography variant="body2" color="text.secondary" sx={{ ml: "auto" }}>
					Showing {sortedRows.length} of {missions.length} missions
				</Typography>
			</Box>

			<TableContainer component={Paper}>
				<Table size="small">
					<TableHead>
						<TableRow>
							{visibleColumnDefs.map((col) => (
								<TableCell key={col.key} align={col.align}>
									<TableSortLabel
										active={sort.key === col.key}
										direction={sort.key === col.key ? sort.direction : "asc"}
										onClick={() => handleSort(col.key)}
									>
										{col.label}
									</TableSortLabel>
								</TableCell>
							))}
						</TableRow>
					</TableHead>
					<TableBody>
						{sortedRows.map((mission) => (
							<ClickableTableRow
								key={mission.id}
								href={`/missions/${mission.id}`}
								sx={rowSx(mission.status)}
							>
								{visibleColumnDefs.map((col) => (
									<TableCell key={col.key} align={col.align}>
										{formatMissionValue(mission[col.key], col)}
									</TableCell>
								))}
							</ClickableTableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
		</Box>
	);
}
