"use client";

import CalibrationHistory from "@/components/CalibrationHistory";
import NvsLink from "@/components/NvsLink";
import PasteCalibrationDialog from "@/components/PasteCalibrationDialog";
import { formatAssetType, formatDate } from "@/lib/format";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import DescriptionIcon from "@mui/icons-material/Description";
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
import type { ScienceSensorRecord, SensorCalRecord } from "@ogdb/types";
import Link from "next/link";
import { Fragment, useState } from "react";

// Asset / L22 model / Parameters / Serial number / Last calibration /
// Certificate / Install date. Fixed so the columns hold their widths when a
// row expands.
const COLUMN_WIDTHS = ["14%", "16%", "20%", "12%", "13%", "15%", "10%"];

// The science sensors of a build -- today's on a glider's Current build, or
// as of launch on a mission's Glider build. Same columns and same row
// expansion either way; only what "last calibration" and "install date"
// are relative to differs, and the sensors passed in already carry that.
export default function ScienceBuildTable({
	sensors,
	mode,
	asOfDate,
	calibrationHistory,
}: {
	sensors: ScienceSensorRecord[];
	// "current": live build, so a new calibration can be pasted in and the
	// newest record really is current. "mission": as of the launch date.
	mode: "current" | "mission";
	asOfDate: string;
	// Full calibration history per asset, newest first, when the caller has
	// it (the glider page). Without it a row shows the one record in effect
	// as of `asOfDate`.
	calibrationHistory?: Record<number, SensorCalRecord[]>;
}) {
	const [expanded, setExpanded] = useState<Set<number>>(new Set());

	function toggle(assetId: number) {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(assetId)) next.delete(assetId);
			else next.add(assetId);
			return next;
		});
	}

	if (sensors.length === 0) {
		return (
			<Typography color="text.disabled" variant="body2">
				{mode === "mission"
					? `No science sensors recorded for this glider as of ${formatDate(asOfDate)}.`
					: "No science sensors currently assigned."}
			</Typography>
		);
	}

	return (
		<Table size="small" sx={{ tableLayout: "fixed" }}>
			<TableHead>
				<TableRow>
					<TableCell sx={{ width: COLUMN_WIDTHS[0] }}>Asset</TableCell>
					<TableCell sx={{ width: COLUMN_WIDTHS[1] }}>L22 Model</TableCell>
					<TableCell sx={{ width: COLUMN_WIDTHS[2] }}>Parameters</TableCell>
					<TableCell sx={{ width: COLUMN_WIDTHS[3] }}>Serial number</TableCell>
					<TableCell sx={{ width: COLUMN_WIDTHS[4] }}>
						Last calibration
					</TableCell>
					<TableCell sx={{ width: COLUMN_WIDTHS[5] }}>Certificate</TableCell>
					<TableCell sx={{ width: COLUMN_WIDTHS[6] }}>Install date</TableCell>
				</TableRow>
			</TableHead>
			<TableBody>
				{sensors.map((s) => {
					const isOpen = expanded.has(s.assetId);
					const typeLabel = formatAssetType(s.assetType);
					const history =
						calibrationHistory?.[s.assetId] ??
						(s.calibration ? [s.calibration] : []);
					return (
						<Fragment key={s.assetId}>
							<TableRow
								hover
								onClick={() => toggle(s.assetId)}
								sx={{ cursor: "pointer" }}
							>
								<TableCell>
									<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
										<ChevronRightIcon
											sx={{
												fontSize: 18,
												color: "text.secondary",
												transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
												transition: "transform 0.15s",
											}}
										/>
										{typeLabel}
									</Box>
								</TableCell>
								<TableCell>
									<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
										{s.model ?? "—"}
										<NvsLink uri={s.modelUri} iconSize={15} />
									</Box>
								</TableCell>
								<TableCell sx={{ overflowWrap: "anywhere" }}>
									{s.measuredParameters.length > 0
										? s.measuredParameters.map((p) => p.label).join(", ")
										: "—"}
								</TableCell>
								<TableCell>
									{s.serialNumber ? (
										<Tooltip title="Open asset details">
											<MuiLink
												component={Link}
												href={`/assets/${s.assetId}`}
												onClick={(e) => e.stopPropagation()}
											>
												{s.serialNumber}
											</MuiLink>
										</Tooltip>
									) : (
										"—"
									)}
								</TableCell>
								<TableCell>{formatDate(s.calibration?.date ?? null)}</TableCell>
								<TableCell>
									{s.calibration?.documentId != null ? (
										<MuiLink
											href={`/api/documents/${s.calibration.documentId}/file`}
											target="_blank"
											rel="noreferrer"
											onClick={(e) => e.stopPropagation()}
											sx={{
												display: "inline-flex",
												alignItems: "center",
												gap: 0.5,
												fontSize: 12.5,
												maxWidth: "100%",
											}}
										>
											<DescriptionIcon sx={{ fontSize: 14, flexShrink: 0 }} />
											<Box
												component="span"
												sx={{
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
											>
												{s.calibration.documentName ?? "Certificate"}
											</Box>
										</MuiLink>
									) : (
										"—"
									)}
								</TableCell>
								<TableCell>{formatDate(s.installDate)}</TableCell>
							</TableRow>
							<TableRow>
								<TableCell
									colSpan={COLUMN_WIDTHS.length}
									sx={{ py: 0, borderBottom: isOpen ? undefined : "none" }}
								>
									<Collapse in={isOpen} timeout="auto" unmountOnExit>
										<Box
											sx={{
												py: 1,
												display: "flex",
												flexDirection: "column",
												gap: 1.5,
											}}
										>
											{mode === "mission" && (
												<Typography
													variant="caption"
													sx={{
														alignSelf: "flex-start",
														bgcolor: "info.main",
														color: "info.contrastText",
														px: 1.25,
														py: 0.5,
														borderRadius: 10,
													}}
												>
													As of {formatDate(asOfDate)} — the calibration in
													effect on this mission, not necessarily this sensor's
													latest
												</Typography>
											)}
											<Box
												sx={{
													display: "flex",
													alignItems: "center",
													justifyContent: "space-between",
												}}
											>
												<Typography variant="subtitle2">
													{typeLabel} calibration information
												</Typography>
												{mode === "current" && (
													<PasteCalibrationDialog
														assetId={s.assetId}
														assetType={s.assetType}
													/>
												)}
											</Box>
											<CalibrationHistory
												calibrations={history}
												firstLabel={
													mode === "mission" ? "in effect at launch" : "current"
												}
											/>
										</Box>
									</Collapse>
								</TableCell>
							</TableRow>
						</Fragment>
					);
				})}
			</TableBody>
		</Table>
	);
}
