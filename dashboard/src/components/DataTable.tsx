"use client";

import DownloadIcon from "@mui/icons-material/Download";
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
import { alpha } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";
import { type ReactNode, useMemo, useState } from "react";
import {
	type ColumnDef,
	TOOLBAR_CONTROL_HEIGHT,
	compareColumnValues,
	defaultVisibleColumns,
	downloadCsv,
	formatColumnValue,
	rowsToCsv,
} from "../lib/data-table";
import ClickableTableRow from "./ClickableTableRow";

export interface DataTableProps<T> {
	rows: T[];
	columns: ColumnDef<T>[];
	getRowId: (row: T) => string | number;
	getRowHref?: (row: T) => string;
	rowSx?: (row: T) => SxProps<Theme> | undefined;
	renderRowActions?: (row: T) => ReactNode;
	defaultSort: { key: ColumnDef<T>["key"]; direction: "asc" | "desc" };
	/** Rendered in the toolbar, between the column picker and the right-aligned slot — e.g. filter controls. */
	toolbarLeft?: ReactNode;
	/** Rendered right-aligned in the toolbar — e.g. a row count. */
	toolbarRight?: ReactNode;
	/** Base file name (no extension/date) for the CSV export button. Omit to hide the button. Exports the current sort order and visible columns, over the (already filtered) `rows`. */
	csvFileNameBase?: string;
	size?: "small" | "medium";
}

export default function DataTable<T>({
	rows,
	columns,
	getRowId,
	getRowHref,
	rowSx,
	renderRowActions,
	defaultSort,
	toolbarLeft,
	toolbarRight,
	csvFileNameBase,
	size = "small",
}: DataTableProps<T>) {
	const [visibleColumns, setVisibleColumns] = useState<ColumnDef<T>["key"][]>(
		defaultVisibleColumns(columns),
	);
	const [sort, setSort] = useState(defaultSort);

	const sortColumn = columns.find((c) => c.key === sort.key);

	const sortedRows = useMemo(() => {
		if (!sortColumn) return rows;
		return [...rows].sort((a, b) =>
			compareColumnValues(
				a[sort.key],
				b[sort.key],
				sortColumn.kind,
				sort.direction,
			),
		);
	}, [rows, sort, sortColumn]);

	const visibleColumnDefs = columns.filter((c) =>
		visibleColumns.includes(c.key),
	);

	function handleSort(key: ColumnDef<T>["key"]) {
		setSort((prev) =>
			prev.key === key
				? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
				: { key, direction: "asc" },
		);
	}

	function handleColumnsChange(
		event: SelectChangeEvent<ColumnDef<T>["key"][]>,
	) {
		const value = event.target.value;
		setVisibleColumns(
			typeof value === "string"
				? (value.split(",") as ColumnDef<T>["key"][])
				: value,
		);
	}

	function handleExportCsv() {
		if (!csvFileNameBase) return;
		downloadCsv(csvFileNameBase, rowsToCsv(sortedRows, visibleColumnDefs));
	}

	return (
		<Box>
			<Box
				sx={(theme) => ({
					display: "flex",
					flexWrap: "wrap",
					alignItems: "center",
					gap: 2,
					mb: 2,
					p: 1.5,
					borderRadius: 1,
					backgroundColor: alpha(
						theme.palette.primary.main,
						theme.palette.mode === "dark" ? 0.12 : 0.06,
					),
					border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.3 : 0.2)}`,
				})}
			>
				<Select
					multiple
					size="small"
					value={visibleColumns}
					onChange={handleColumnsChange}
					renderValue={(selected) => `${selected.length} columns`}
					sx={{ minWidth: 160, height: TOOLBAR_CONTROL_HEIGHT }}
				>
					{columns.map((col) => (
						<MenuItem key={col.key} value={col.key}>
							<Checkbox
								checked={visibleColumns.includes(col.key)}
								size="small"
							/>
							<ListItemText primary={col.label} />
						</MenuItem>
					))}
				</Select>

				{toolbarLeft}

				<Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 2 }}>
					{toolbarRight}
					{csvFileNameBase && (
						<Button
							size="small"
							variant="contained"
							disableElevation
							startIcon={<DownloadIcon fontSize="small" />}
							sx={{ height: TOOLBAR_CONTROL_HEIGHT }}
							onClick={handleExportCsv}
						>
							Export to CSV
						</Button>
					)}
				</Box>
			</Box>

			<TableContainer component={Paper}>
				<Table size={size}>
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
							{renderRowActions && (
								<TableCell align="center" style={{ width: 1 }} />
							)}
						</TableRow>
					</TableHead>
					<TableBody>
						{sortedRows.map((row) => {
							const rowId = getRowId(row);
							const cells = (
								<RowCells
									key={rowId}
									row={row}
									columns={visibleColumnDefs}
									renderRowActions={renderRowActions}
								/>
							);
							return getRowHref ? (
								<ClickableTableRow
									key={rowId}
									href={getRowHref(row)}
									sx={rowSx?.(row)}
								>
									{cells}
								</ClickableTableRow>
							) : (
								<TableRow key={rowId} sx={rowSx?.(row)}>
									{cells}
								</TableRow>
							);
						})}
					</TableBody>
				</Table>
			</TableContainer>
		</Box>
	);
}

function RowCells<T>({
	row,
	columns,
	renderRowActions,
}: {
	row: T;
	columns: ColumnDef<T>[];
	renderRowActions?: (row: T) => ReactNode;
}) {
	return (
		<>
			{columns.map((col) => (
				<TableCell key={col.key} align={col.align}>
					{col.renderCell
						? col.renderCell(row)
						: formatColumnValue(row[col.key], col)}
				</TableCell>
			))}
			{renderRowActions && (
				<TableCell align="center">{renderRowActions(row)}</TableCell>
			)}
		</>
	);
}
