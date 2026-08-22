"use client";

import StatusEditor from "@/components/StatusEditor";
import { formatAssetType, formatDate, formatUsd } from "@/lib/format";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import type { Asset, AssetStatusOption } from "@ogdb/types";
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

// Assets that are gliders live under Fleet's own detail page — the
// asset's id IS the glider's id (gliders are just assets with
// asset_type "glider"), so no separate lookup is needed.
function detailHref(asset: { id: number; assetType: string }) {
	return asset.assetType === "glider"
		? `/gliders/${asset.id}`
		: `/assets/${asset.id}`;
}

export default function AssetsTable({
	assets,
	statusOptions,
	canEdit,
}: {
	assets: Asset[];
	statusOptions: AssetStatusOption[];
	canEdit: boolean;
}) {
	const [showDecommissioned, setShowDecommissioned] = useState(false);
	const [filterState, setFilterState] = useState<FilterState>({});

	const columns: ColumnDef<Asset>[] = useMemo(
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
			{
				key: "assetType",
				label: "Asset type",
				kind: "string",
				defaultVisible: true,
				format: (v) => formatAssetType(String(v)),
			},
			{
				key: "assetModel",
				label: "Asset model",
				kind: "string",
				defaultVisible: true,
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
				renderCell: (asset) => (
					<StatusEditor
						kind="assets"
						id={asset.id}
						statusId={asset.statusId}
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

	const assetTypeFilter: FilterDef<Asset> = useMemo(() => {
		const values = Array.from(new Set(assets.map((a) => a.assetType))).sort(
			(a, b) => a.localeCompare(b),
		);
		return {
			key: "assetType",
			label: "Asset type",
			type: "multiSelect",
			getValue: (a) => a.assetType,
			options: values.map((v) => ({ value: v, label: formatAssetType(v) })),
		};
	}, [assets]);

	const statusFilter: FilterDef<Asset> = useMemo(
		() => ({
			key: "status",
			label: "Status",
			type: "multiSelect",
			getValue: (a) => a.statusId,
			options: [...statusOptions]
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((o) => ({ value: String(o.id), label: STATUS_LABEL[o.name] })),
		}),
		[statusOptions],
	);

	const filters = useMemo(
		() => [assetTypeFilter, statusFilter],
		[assetTypeFilter, statusFilter],
	);

	const visibleAssets = showDecommissioned
		? assets
		: assets.filter((a) => a.status !== "decommissioned");

	const filteredRows = useMemo(
		() => applyFilters(visibleAssets, filters, filterState),
		[visibleAssets, filters, filterState],
	);

	const hasActiveFilters = filters.some((f) =>
		isFilterActive(f, filterState[f.key]),
	);

	return (
		<DataTable<Asset>
			rows={filteredRows}
			columns={columns}
			getRowId={(a) => a.id}
			getRowHref={detailHref}
			defaultSort={{ key: "name", direction: "asc" }}
			csvFileNameBase="assets"
			toolbarLeft={
				<>
					<FilterBar
						rows={assets}
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
