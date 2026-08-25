"use client";

import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import type { DatasetProcessingStatus } from "@ogdb/types";
import { useMemo, useState } from "react";
import { type ColumnDef, TOOLBAR_CONTROL_HEIGHT } from "../lib/data-table";
import {
	type FilterDef,
	type FilterState,
	applyFilters,
	isFilterActive,
} from "../lib/table-filters";
import DataTable from "./DataTable";
import FilterBar from "./FilterBar";

// Datasets have no missionNumber field of their own — the page fetches
// missions alongside dataset statuses and merges it in, since it's the
// same natural index used on the Missions table.
export type DatasetRow = DatasetProcessingStatus & {
	missionNumber: number | null;
};

function StatusIcon({ done }: { done: boolean }) {
	return done ? (
		<CheckCircleIcon fontSize="small" color="success" />
	) : (
		<CancelIcon fontSize="small" color="error" />
	);
}

const STAGE_COLUMNS: {
	key: keyof DatasetRow;
	label: string;
}[] = [
	{ key: "rawStatus", label: "Raw archived" },
	{ key: "dmStatus", label: "Delayed mode status" },
	{ key: "pubStatus", label: "Production status" },
	{ key: "og1", label: "OG1" },
];

const DATASET_COLUMNS: ColumnDef<DatasetRow>[] = [
	{
		key: "missionNumber",
		label: "Mission #",
		kind: "number",
		defaultVisible: true,
	},
	{
		key: "missionName",
		label: "Mission",
		kind: "string",
		defaultVisible: true,
	},
	...STAGE_COLUMNS.map(
		({ key, label }): ColumnDef<DatasetRow> => ({
			key,
			label,
			kind: "boolean",
			defaultVisible: true,
			align: "center",
			renderCell: (row) => <StatusIcon done={Boolean(row[key])} />,
		}),
	),
	{
		key: "erddap",
		label: "ERDDAP",
		kind: "string",
		defaultVisible: true,
	},
	{
		key: "doi",
		label: "DOI",
		kind: "string",
		defaultVisible: true,
	},
];

export default function DatasetsTable({
	datasets,
}: {
	datasets: DatasetRow[];
}) {
	const [filterState, setFilterState] = useState<FilterState>({});

	const missionFilter: FilterDef<DatasetRow> = useMemo(() => {
		const seen = new Map<number, string>();
		for (const d of datasets) seen.set(d.missionId, d.missionName);
		const options = Array.from(seen, ([id, name]) => ({
			value: String(id),
			label: name,
		})).sort((a, b) => a.label.localeCompare(b.label));
		return {
			key: "mission",
			label: "Mission",
			type: "multiSelect",
			getValue: (d) => d.missionId,
			options,
		};
	}, [datasets]);

	const filters = useMemo(() => [missionFilter], [missionFilter]);

	const filteredRows = useMemo(
		() => applyFilters(datasets, filters, filterState),
		[datasets, filters, filterState],
	);

	const hasActiveFilters = filters.some((f) =>
		isFilterActive(f, filterState[f.key]),
	);

	return (
		<DataTable<DatasetRow>
			rows={filteredRows}
			columns={DATASET_COLUMNS}
			getRowId={(d) => d.missionId}
			getRowHref={(d) => `/datasets/${d.missionId}`}
			defaultSort={{ key: "missionNumber", direction: "desc" }}
			csvFileNameBase="datasets"
			toolbarLeft={
				<>
					<FilterBar
						rows={datasets}
						filters={filters}
						value={filterState}
						onChange={setFilterState}
					/>
					{hasActiveFilters && (
						<Button
							size="small"
							sx={{ height: TOOLBAR_CONTROL_HEIGHT }}
							onClick={() => setFilterState({})}
						>
							Clear filters
						</Button>
					)}
				</>
			}
			toolbarRight={
				hasActiveFilters ? (
					<Typography variant="body2" color="text.secondary">
						Showing {filteredRows.length} of {datasets.length} datasets
					</Typography>
				) : undefined
			}
		/>
	);
}
