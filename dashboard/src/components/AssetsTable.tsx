"use client";

import StatusEditor from "@/components/StatusEditor";
import { formatAssetType, formatDate, formatMoney } from "@/lib/format";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import type { Asset, AssetStatusOption, ServicingRequired } from "@ogdb/types";
import { useMemo, useState } from "react";
import type { ColumnDef } from "../lib/data-table";
import { STATUS_LABEL } from "../lib/status-meta";
import {
	type FilterDef,
	type FilterState,
	applyFilters,
	isFilterActive,
} from "../lib/table-filters";
import DataTable from "./DataTable";
import FilterBar from "./FilterBar";
import ServicingRequiredChip from "./ServicingRequiredChip";

// Gliders and batteries live under their own detail pages — the asset's
// id IS the glider's/battery's id (both are just assets with the matching
// asset_type), so no separate lookup is needed.
function detailHref(asset: { id: number; assetType: string }) {
	if (asset.assetType === "glider") return `/gliders/${asset.id}`;
	if (asset.assetType === "battery") return `/battery/${asset.id}`;
	return `/assets/${asset.id}`;
}

export default function AssetsTable({
	assets: allAssets,
	statusOptions,
	canEdit,
	servicingRequired = [],
}: {
	assets: Asset[];
	statusOptions: AssetStatusOption[];
	canEdit: boolean;
	// Open "servicing required" flags, shown as a (read-only) red chip.
	servicingRequired?: ServicingRequired[];
}) {
	const flagByAsset = useMemo(
		() => new Map(servicingRequired.map((f) => [f.assetId, f])),
		[servicingRequired],
	);
	const [showDecommissioned, setShowDecommissioned] = useState(false);
	const [filterState, setFilterState] = useState<FilterState>({});

	// Batteries have their own catalogue (/batteries) with battery-specific
	// columns -- they're still assets (still in the DB, still have a detail
	// page), just not listed in this generic table. Filtered here rather
	// than server-side so /assets stays a plain "all assets" fetch.
	const assets = useMemo(
		() => allAssets.filter((a) => a.assetType !== "battery"),
		[allAssets],
	);

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
				key: "purchaseValue",
				label: "Purchase value",
				kind: "number",
				defaultVisible: true,
				align: "right",
				renderCell: (row) =>
					formatMoney(row.purchaseValue, row.purchaseCurrency),
			},
			{
				key: "purchaseCurrency",
				label: "Currency",
				kind: "string",
				defaultVisible: false,
			},
			{
				key: "status",
				label: "Status",
				kind: "string",
				defaultVisible: true,
				capitalize: true,
				renderCell: (asset) => (
					<Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
						<StatusEditor
							kind="assets"
							id={asset.id}
							statusId={asset.statusId}
							options={statusOptions}
							disabled={!canEdit}
						/>
						<ServicingRequiredChip
							flag={flagByAsset.get(asset.id)}
							assetLabel={
								asset.name ?? asset.serialNumber ?? `Asset ${asset.id}`
							}
						/>
					</Box>
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
		[statusOptions, canEdit, flagByAsset],
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
		: assets.filter(
				// Decommissioned = the date is set (what the fleet lifecycle and the
				// cascades from a glider write) OR the status says so / destroyed.
				(a) =>
					a.decommissionedDate == null &&
					a.status !== "decommissioned" &&
					a.status !== "destroyed",
			);

	const filteredRows = useMemo(
		() => applyFilters(visibleAssets, filters, filterState),
		[visibleAssets, filters, filterState],
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
				<FilterBar
					rows={assets}
					filters={filters}
					value={filterState}
					onChange={setFilterState}
				/>
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
