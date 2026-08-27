"use client";

import StatusEditor from "@/components/StatusEditor";
import { formatUsd } from "@/lib/format";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import type { AssetStatusOption, Battery } from "@ogdb/types";
import { useMemo, useState } from "react";
import { type ColumnDef, TOOLBAR_CONTROL_HEIGHT } from "../lib/data-table";
import { STATUS_LABEL } from "../lib/status-meta";
import {
	type FilterDef,
	type FilterState,
	applyFilters,
	isFilterActive,
} from "../lib/table-filters";
import DataTable from "./DataTable";
import FilterBar from "./FilterBar";

// A battery IS an asset (asset_type "battery"), so its detail page is the
// shared asset detail page -- same as every non-glider asset in the "All
// assets" table.
function detailHref(battery: { id: number }) {
	return `/assets/${battery.id}`;
}

export default function BatteriesTable({
	batteries,
	statusOptions,
	canEdit,
}: {
	batteries: Battery[];
	statusOptions: AssetStatusOption[];
	canEdit: boolean;
}) {
	const [showDecommissioned, setShowDecommissioned] = useState(false);
	const [filterState, setFilterState] = useState<FilterState>({});

	const columns: ColumnDef<Battery>[] = useMemo(
		() => [
			{
				key: "serialNumber",
				label: "Serial number",
				kind: "string",
				defaultVisible: true,
			},
			{
				key: "batteryModel",
				label: "Battery model",
				kind: "string",
				defaultVisible: true,
			},
			{
				key: "institute",
				label: "Institute",
				kind: "string",
				defaultVisible: true,
			},
			{
				key: "dateOfManufacture",
				label: "Date of manufacture",
				kind: "date",
				defaultVisible: true,
			},
			{
				key: "weight",
				label: "Weight (g)",
				kind: "number",
				defaultVisible: true,
				align: "right",
			},
			{
				key: "purchaseDate",
				label: "Purchase date",
				kind: "date",
				defaultVisible: true,
			},
			{
				key: "purchaseValueUsd",
				label: "Purchase value",
				kind: "number",
				defaultVisible: true,
				align: "right",
				format: (v) => formatUsd(v as number | null),
			},
			{
				key: "status",
				label: "Status",
				kind: "string",
				defaultVisible: true,
				capitalize: true,
				renderCell: (battery) => (
					<StatusEditor
						kind="assets"
						id={battery.id}
						statusId={battery.statusId}
						options={statusOptions}
						disabled={!canEdit}
					/>
				),
			},
			{
				key: "id",
				label: "Record ID",
				kind: "number",
				defaultVisible: false,
				align: "right",
			},
		],
		[statusOptions, canEdit],
	);

	const batteryModelFilter: FilterDef<Battery> = useMemo(
		() => ({
			key: "batteryModel",
			label: "Battery model",
			type: "multiSelect",
			getValue: (b) => b.batteryModel,
		}),
		[],
	);

	const statusFilter: FilterDef<Battery> = useMemo(
		() => ({
			key: "status",
			label: "Status",
			type: "multiSelect",
			getValue: (b) => b.statusId,
			options: [...statusOptions]
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((o) => ({ value: String(o.id), label: STATUS_LABEL[o.name] })),
		}),
		[statusOptions],
	);

	const filters = useMemo(
		() => [batteryModelFilter, statusFilter],
		[batteryModelFilter, statusFilter],
	);

	const visibleBatteries = showDecommissioned
		? batteries
		: batteries.filter((b) => b.status !== "decommissioned");

	const filteredRows = useMemo(
		() => applyFilters(visibleBatteries, filters, filterState),
		[visibleBatteries, filters, filterState],
	);

	const hasActiveFilters = filters.some((f) =>
		isFilterActive(f, filterState[f.key]),
	);

	return (
		<DataTable<Battery>
			rows={filteredRows}
			columns={columns}
			getRowId={(b) => b.id}
			getRowHref={detailHref}
			defaultSort={{ key: "serialNumber", direction: "asc" }}
			csvFileNameBase="batteries"
			toolbarLeft={
				<>
					<FilterBar
						rows={batteries}
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
				<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
					<FormControlLabel
						sx={{ m: 0 }}
						control={
							<Checkbox
								size="small"
								checked={showDecommissioned}
								onChange={(e) => setShowDecommissioned(e.target.checked)}
							/>
						}
						label="Show decommissioned"
					/>
				</Box>
			}
		/>
	);
}
