"use client";

import StatusEditor from "@/components/StatusEditor";
import { formatDate } from "@/lib/format";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Tooltip from "@mui/material/Tooltip";
import type { AssetStatusOption, Glider } from "@ogdb/types";
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

export default function GlidersTable({
	gliders,
	statusOptions,
	canEdit,
}: {
	gliders: Glider[];
	statusOptions: AssetStatusOption[];
	canEdit: boolean;
}) {
	const [showDecommissioned, setShowDecommissioned] = useState(false);
	const [filterState, setFilterState] = useState<FilterState>({});

	const columns: ColumnDef<Glider>[] = useMemo(
		() => [
			{
				key: "name",
				label: "Name",
				kind: "string",
				defaultVisible: true,
				capitalize: true,
			},
			{
				key: "serialNumber",
				label: "Serial number",
				kind: "string",
				defaultVisible: true,
			},
			{ key: "wmo", label: "WMO", kind: "string", defaultVisible: true },
			{
				key: "platform",
				label: "Platform",
				kind: "string",
				defaultVisible: true,
				capitalize: true,
				renderCell: (g) => (
					<Tooltip title={g.platformCategoryDefinition ?? ""}>
						<span>
							{g.platform
								? [g.platform, g.platformModel].filter(Boolean).join(" ")
								: "—"}
						</span>
					</Tooltip>
				),
			},
			{
				key: "manufacturer",
				label: "Manufacturer",
				kind: "string",
				defaultVisible: true,
				renderCell: (g) => (
					<Tooltip title={g.manufacturerL35Definition ?? ""}>
						<span>{g.manufacturerL35Name ?? g.manufacturer ?? "—"}</span>
					</Tooltip>
				),
			},
			{
				key: "purchaseDate",
				label: "Purchase date",
				kind: "date",
				defaultVisible: true,
			},
			{ key: "owner", label: "Owner", kind: "string", defaultVisible: true },
			{
				key: "status",
				label: "Status",
				kind: "string",
				defaultVisible: true,
				capitalize: true,
				renderCell: (g) => (
					<StatusEditor
						kind="gliders"
						id={g.id}
						statusId={g.statusId}
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

	const platformFilter: FilterDef<Glider> = useMemo(
		() => ({
			key: "platform",
			label: "Platform",
			type: "multiSelect",
			getValue: (g) => g.platform,
		}),
		[],
	);

	const manufacturerFilter: FilterDef<Glider> = useMemo(
		() => ({
			key: "manufacturer",
			label: "Manufacturer",
			type: "multiSelect",
			getValue: (g) => g.manufacturerL35Name ?? g.manufacturer,
		}),
		[],
	);

	const statusFilter: FilterDef<Glider> = useMemo(
		() => ({
			key: "status",
			label: "Status",
			type: "multiSelect",
			getValue: (g) => g.statusId,
			options: [...statusOptions]
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((o) => ({ value: String(o.id), label: STATUS_LABEL[o.name] })),
		}),
		[statusOptions],
	);

	const filters = useMemo(
		() => [platformFilter, manufacturerFilter, statusFilter],
		[platformFilter, manufacturerFilter, statusFilter],
	);

	const visibleGliders = showDecommissioned
		? gliders
		: gliders.filter((g) => g.status !== "decommissioned");

	const filteredRows = useMemo(
		() => applyFilters(visibleGliders, filters, filterState),
		[visibleGliders, filters, filterState],
	);

	const hasActiveFilters = filters.some((f) =>
		isFilterActive(f, filterState[f.key]),
	);

	return (
		<DataTable<Glider>
			rows={filteredRows}
			columns={columns}
			getRowId={(g) => g.id}
			getRowHref={(g) => `/gliders/${g.id}`}
			defaultSort={{ key: "name", direction: "asc" }}
			csvFileNameBase="gliders"
			toolbarLeft={
				<>
					<FilterBar
						rows={gliders}
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
