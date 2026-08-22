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

function StatusIcon({ done }: { done: boolean }) {
	return done ? (
		<CheckCircleIcon fontSize="small" color="success" />
	) : (
		<CancelIcon fontSize="small" color="error" />
	);
}

const STAGE_COLUMNS: {
	key: keyof DatasetProcessingStatus;
	label: string;
}[] = [
	{ key: "l0Status", label: "L0" },
	{ key: "l1Status", label: "L1" },
	{ key: "l1Og1", label: "L1 OG1" },
	{ key: "l2Status", label: "L2" },
	{ key: "l2Og1", label: "L2 OG1" },
];

const DATASET_COLUMNS: ColumnDef<DatasetProcessingStatus>[] = [
	{
		key: "missionName",
		label: "Mission",
		kind: "string",
		defaultVisible: true,
	},
	...STAGE_COLUMNS.map(
		({ key, label }): ColumnDef<DatasetProcessingStatus> => ({
			key,
			label,
			kind: "boolean",
			defaultVisible: true,
			align: "center",
			renderCell: (row) => <StatusIcon done={Boolean(row[key])} />,
		}),
	),
];

export default function DatasetsTable({
	datasets,
}: {
	datasets: DatasetProcessingStatus[];
}) {
	const [filterState, setFilterState] = useState<FilterState>({});

	const missionFilter: FilterDef<DatasetProcessingStatus> = useMemo(() => {
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
		<DataTable<DatasetProcessingStatus>
			rows={filteredRows}
			columns={DATASET_COLUMNS}
			getRowId={(d) => d.missionId}
			getRowHref={(d) => `/datasets/${d.missionId}`}
			defaultSort={{ key: "missionName", direction: "asc" }}
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
