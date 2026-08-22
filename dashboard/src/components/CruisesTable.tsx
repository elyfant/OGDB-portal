"use client";

import Button from "@mui/material/Button";
import type { Cruise } from "@ogdb/types";
import { useMemo, useState } from "react";
import { CRUISE_COLUMNS } from "../lib/cruise-columns";
import { TOOLBAR_CONTROL_HEIGHT } from "../lib/data-table";
import {
	type FilterDef,
	type FilterState,
	applyFilters,
	isFilterActive,
} from "../lib/table-filters";
import DataTable from "./DataTable";
import FilterBar from "./FilterBar";

export default function CruisesTable({ cruises }: { cruises: Cruise[] }) {
	const [filterState, setFilterState] = useState<FilterState>({});

	// Neither field is backed by a lookup table (Cruise carries no FK ids at
	// all — institute/vessel are plain text), so options are derived from
	// whatever values are actually present in the loaded rows.
	const vesselFilter: FilterDef<Cruise> = useMemo(
		() => ({
			key: "vessel",
			label: "Vessel",
			type: "multiSelect",
			getValue: (c) => c.vessel,
		}),
		[],
	);

	const instituteFilter: FilterDef<Cruise> = useMemo(
		() => ({
			key: "institute",
			label: "Institute",
			type: "multiSelect",
			getValue: (c) => c.institute,
		}),
		[],
	);

	const filters = useMemo(
		() => [vesselFilter, instituteFilter],
		[vesselFilter, instituteFilter],
	);

	const filteredRows = useMemo(
		() => applyFilters(cruises, filters, filterState),
		[cruises, filters, filterState],
	);

	const hasActiveFilters = filters.some((f) =>
		isFilterActive(f, filterState[f.key]),
	);

	return (
		<DataTable<Cruise>
			rows={filteredRows}
			columns={CRUISE_COLUMNS}
			getRowId={(c) => c.id}
			getRowHref={(c) => `/cruises/${c.id}`}
			defaultSort={{ key: "startDate", direction: "desc" }}
			csvFileNameBase="cruises"
			toolbarLeft={
				<>
					<FilterBar
						rows={cruises}
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
		/>
	);
}
