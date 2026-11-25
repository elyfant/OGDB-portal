"use client";

import { formatDate } from "@/lib/format";
import { hasLocation, locationName, locationText } from "@/lib/glider-location";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Tooltip from "@mui/material/Tooltip";
import type { AssetStatus, Glider } from "@ogdb/types";
import { useMemo, useState } from "react";
import type { ColumnDef } from "../lib/data-table";
import { STATUS_COLOR, STATUS_LABEL } from "../lib/status-meta";
import {
	type FilterDef,
	type FilterState,
	applyFilters,
	isFilterActive,
} from "../lib/table-filters";
import DataTable from "./DataTable";
import FilterBar from "./FilterBar";

function statusTooltip(g: Glider): string {
	if (!g.statusSince) return "";
	const since = `since ${formatDate(g.statusSince)}`;
	// "mission" covers Deployed, Workshop and Ready to deploy, so name the
	// state rather than assuming it's Deployed.
	if (g.statusSource === "mission" && g.status)
		return `${STATUS_LABEL[g.status]} ${since} · from a mission`;
	if (g.statusSource === "service_event")
		return `${since} · from a logged event`;
	return since;
}

export default function GlidersTable({
	gliders,
}: {
	gliders: Glider[];
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
			{
				key: "wmo",
				label: "WMO",
				headerInfo: (
					<>
						Referred to as <em>WMO id</em> in OG1 terminology, and{" "}
						<em>GTS id</em> in OceanOPS's API
					</>
				),
				kind: "string",
				defaultVisible: true,
			},
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
				label: "State",
				headerInfo: (
					<>
						Derived from the glider's timeline, never typed. A{" "}
						<em>Scheduled</em> tag means a mission is assigned; it does not
						change the state.
					</>
				),
				kind: "string",
				defaultVisible: true,
				renderCell: (g) => (
					<Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
						{g.status && (
							<Tooltip title={statusTooltip(g)}>
								<Chip
									label={STATUS_LABEL[g.status]}
									color={STATUS_COLOR[g.status]}
									size="small"
								/>
							</Tooltip>
						)}
						{g.scheduledMissionId != null && (
							<Tooltip
								title={`Mission assigned${
									g.scheduledDate
										? ` · planned ${formatDate(g.scheduledDate)}`
										: ""
								}`}
							>
								<Chip
									label="Scheduled"
									size="small"
									color="info"
									variant="outlined"
								/>
							</Tooltip>
						)}
						{g.decommissionedDate && (
							<Tooltip
								title={`Decommissioned ${formatDate(g.decommissionedDate)}${
									g.decommissionReason ? ` · ${g.decommissionReason}` : ""
								}`}
							>
								<Chip label="Decommissioned" size="small" variant="outlined" />
							</Tooltip>
						)}
					</Box>
				),
			},
			{
				key: "location",
				label: "Location",
				headerInfo: (
					<>
						Where it is, and since when. Optional: <em>Not recorded</em> is
						normal for a glider that has been recovered and not updated.
					</>
				),
				kind: "string",
				defaultVisible: true,
				renderCell: (g) => (
					<Box
						component="span"
						sx={{ color: hasLocation(g) ? "text.primary" : "text.disabled" }}
					>
						{locationText(g)}
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
		[],
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

	const statusFilter: FilterDef<Glider> = useMemo(() => {
		const present = Array.from(
			new Set(
				gliders.map((g) => g.status).filter((s): s is AssetStatus => !!s),
			),
		);
		return {
			key: "status",
			label: "State",
			type: "multiSelect",
			getValue: (g) => g.status,
			options: present
				.sort((a, b) => STATUS_LABEL[a].localeCompare(STATUS_LABEL[b]))
				.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
		};
	}, [gliders]);

	// By place name only (not the "since" date), with "Not recorded" as its
	// own choice so unrecorded gliders can be found and chased up.
	const locationFilter: FilterDef<Glider> = useMemo(
		() => ({
			key: "location",
			label: "Location",
			type: "multiSelect",
			getValue: (g) => locationName(g),
		}),
		[],
	);

	const scheduledFilter: FilterDef<Glider> = useMemo(
		() => ({
			key: "scheduled",
			label: "Scheduled",
			type: "multiSelect",
			getValue: (g) =>
				g.scheduledMissionId != null ? "Scheduled" : "Not scheduled",
		}),
		[],
	);

	const filters = useMemo(
		() => [
			platformFilter,
			manufacturerFilter,
			statusFilter,
			locationFilter,
			scheduledFilter,
		],
		[
			platformFilter,
			manufacturerFilter,
			statusFilter,
			locationFilter,
			scheduledFilter,
		],
	);

	const visibleGliders = showDecommissioned
		? gliders
		: gliders.filter((g) => g.decommissionedDate == null);

	const filteredRows = useMemo(
		() => applyFilters(visibleGliders, filters, filterState),
		[visibleGliders, filters, filterState],
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
				<FilterBar
					rows={gliders}
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
