"use client";

import GliderComponentDetailPanel from "@/components/GliderComponentDetailPanel";
import NvsLink from "@/components/NvsLink";
import { formatAssetType, formatDate } from "@/lib/format";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import MuiLink from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { GliderBuildComponent, GliderComponentDetail } from "@ogdb/types";
import Link from "next/link";
import { Fragment, useState } from "react";

// Fixed display order — Fiona's spec. Any group not present (e.g. no
// tracking assets on this glider) is skipped rather than shown empty.
//
// Science sensors aren't listed here: ScienceBuildTable shows them, with
// their parameters and calibration, the same way on every page.
//
// "hull" isn't an asset type group in the database (hulls live in
// "structural" with the sections), so it's split out by asset type below.
// "structural" therefore means the sections: anything assigned that isn't
// a hull, power or a sensor.
const GROUP_ORDER = ["structural", "hull", "power", "tracking"];
const GROUP_LABEL: Record<string, string> = {
	structural: "Sections",
	hull: "Hulls",
	power: "Power",
	tracking: "Tracking",
};

function displayGroup(c: GliderBuildComponent): string {
	return c.assetType === "slocum_hull" ? "hull" : c.assetTypeGroup;
}

// Fixed so the Asset/Model/Serial/Install date columns line up across
// every group's table, not just within one — each group renders its own
// <Table> (for the section heading above it), so without an explicit,
// shared column layout each one auto-sizes independently.
const COLUMN_WIDTHS = ["34%", "34%", "17%", "15%"];

export default function GliderCurrentBuild({
	components,
	componentDetails = [],
}: {
	components: GliderBuildComponent[];
	// Rows with a detail record expand to show it; without any (a mission's
	// build as of launch has none loaded) the rows are plain.
	componentDetails?: GliderComponentDetail[];
}) {
	const [expanded, setExpanded] = useState<Set<number>>(new Set());

	const typeByAssetId = new Map(
		components.map((c) => [c.assetId, c.assetType]),
	);
	const detailByAssetId = new Map(componentDetails.map((d) => [d.assetId, d]));

	// Keyed by assetId, not assignmentId -- the core aft section row has no
	// assignmentId (1:1 identity link, not an assignment) but still expands
	// to show its detail table.
	function toggle(assetId: number) {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(assetId)) next.delete(assetId);
			else next.add(assetId);
			return next;
		});
	}

	const groups = GROUP_ORDER.map((group) => ({
		group,
		items: components.filter((c) => displayGroup(c) === group),
	})).filter((g) => g.items.length > 0);

	if (groups.length === 0) return null;

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
			{groups.map(({ group, items }) => (
				<Box key={group}>
					<Typography
						variant="overline"
						sx={{ color: "text.secondary", letterSpacing: 1 }}
					>
						{GROUP_LABEL[group]}
					</Typography>
					<Table size="small" sx={{ tableLayout: "fixed" }}>
						<TableHead>
							<TableRow>
								<TableCell sx={{ width: COLUMN_WIDTHS[0] }}>Asset</TableCell>
								<TableCell sx={{ width: COLUMN_WIDTHS[1] }}>Model</TableCell>
								<TableCell sx={{ width: COLUMN_WIDTHS[2] }}>
									Serial number
								</TableCell>
								<TableCell sx={{ width: COLUMN_WIDTHS[3] }}>
									Install date
								</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{items.map((c) => {
								const parentType = typeByAssetId.get(c.parentAssetId);
								const mountedIn =
									c.depth > 1 && parentType
										? formatAssetType(parentType)
										: null;
								const detail = detailByAssetId.get(c.assetId);
								const isOpen = expanded.has(c.assetId);

								return (
									<Fragment key={c.assetId}>
										<TableRow
											hover={!!detail}
											onClick={detail ? () => toggle(c.assetId) : undefined}
											sx={detail ? { cursor: "pointer" } : undefined}
										>
											<TableCell>
												<Box
													sx={{
														display: "flex",
														alignItems: "center",
														gap: 0.5,
													}}
												>
													{detail && (
														<ChevronRightIcon
															sx={{
																fontSize: 18,
																color: "text.secondary",
																transform: isOpen
																	? "rotate(90deg)"
																	: "rotate(0deg)",
																transition: "transform 0.15s",
															}}
														/>
													)}
													{formatAssetType(c.assetType)}
													{c.position && (
														<Box
															component="span"
															sx={{ color: "text.secondary" }}
														>
															({c.position})
														</Box>
													)}
													{mountedIn && (
														<Box
															component="span"
															sx={{ color: "text.secondary" }}
														>
															(mounted in {mountedIn.toLowerCase()})
														</Box>
													)}
												</Box>
											</TableCell>
											<TableCell>
												<Box
													sx={{
														display: "flex",
														alignItems: "center",
														gap: 0.5,
													}}
												>
													{c.model ?? "—"}
													<NvsLink uri={c.modelUri} iconSize={15} />
												</Box>
											</TableCell>
											<TableCell>
												{c.serialNumber ? (
													<Tooltip title="Open asset details">
														<MuiLink
															component={Link}
															href={`/assets/${c.assetId}`}
															onClick={(e) => e.stopPropagation()}
														>
															{c.serialNumber}
														</MuiLink>
													</Tooltip>
												) : (
													"—"
												)}
											</TableCell>
											<TableCell>{formatDate(c.installDate)}</TableCell>
										</TableRow>
										{detail && (
											<TableRow>
												<TableCell
													colSpan={4}
													sx={{
														py: 0,
														borderBottom: isOpen ? undefined : "none",
													}}
												>
													<Collapse in={isOpen} timeout="auto" unmountOnExit>
														<GliderComponentDetailPanel
															assetType={c.assetType}
															detail={detail}
														/>
													</Collapse>
												</TableCell>
											</TableRow>
										)}
									</Fragment>
								);
							})}
						</TableBody>
					</Table>
				</Box>
			))}
		</Box>
	);
}
