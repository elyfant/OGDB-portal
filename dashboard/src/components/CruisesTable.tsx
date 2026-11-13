"use client";

import type { Cruise } from "@ogdb/types";
import { useMemo, useState } from "react";
import { CRUISE_COLUMNS } from "../lib/cruise-columns";
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
	// all — agency/vessel are plain text), so options are derived from
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

	const agencyFilter: FilterDef<Cruise> = useMemo(
		() => ({
			key: "agency",
			label: "Agency",
			type: "multiSelect",
			getValue: (c) => c.agency,
		}),
		[],
	);

	const filters = useMemo(
		() => [vesselFilter, agencyFilter],
		[vesselFilter, agencyFilter],
	);

	const filteredRows = useMemo(
		() => applyFilters(cruises, filters, filterState),
		[cruises, filters, filterState],
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
				<FilterBar
					rows={cruises}
					filters={filters}
					value={filterState}
					onChange={setFilterState}
				/>
			}
		/>
	);
}
