"use client";

import { renderSgCalibConstants } from "@/lib/calibration-paste";
import { formatAssetType, formatDate, formatFieldValue } from "@/lib/format";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { ScienceSensorRecord } from "@ogdb/types";
import { Fragment, useState } from "react";

function CoefficientGrid({
	coefficients,
}: {
	coefficients: Record<string, number | string | null>;
}) {
	const entries = Object.entries(coefficients).filter(
		([, value]) => value !== null && value !== undefined,
	);
	if (entries.length === 0) {
		return (
			<Typography variant="body2" color="text.disabled">
				No coefficients recorded.
			</Typography>
		);
	}
	return (
		<Box
			sx={{
				display: "grid",
				gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
				gap: 1,
				fontFamily: "monospace",
				fontSize: 12,
			}}
		>
			{entries.map(([key, value]) => (
				<Box key={key}>
					<Box component="span" sx={{ color: "text.secondary" }}>
						{key}
					</Box>{" "}
					{formatFieldValue(value)}
				</Box>
			))}
		</Box>
	);
}

function SgCalibConstantsDialog({
	coefficients,
	serialNumber,
	onClose,
}: {
	coefficients: Record<string, number | string | null>;
	serialNumber: string | null;
	onClose: () => void;
}) {
	const text = renderSgCalibConstants(coefficients);
	return (
		<Dialog open onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle>sg_calib_constants.m — SN {serialNumber ?? "—"}</DialogTitle>
			<DialogContent dividers>
				<Typography
					variant="caption"
					color="text.secondary"
					sx={{ mb: 1.5, display: "block" }}
				>
					Generated from this calibration record — not a copy of an original
					file, so it can't go stale.
				</Typography>
				<Box
					component="pre"
					sx={{
						fontFamily: "monospace",
						fontSize: 12,
						bgcolor: "action.hover",
						p: 2,
						borderRadius: 1,
						overflowX: "auto",
						m: 0,
					}}
				>
					{text}
				</Box>
			</DialogContent>
			<DialogActions>
				<Button
					onClick={() => navigator.clipboard.writeText(text)}
					size="small"
				>
					Copy
				</Button>
				<Button onClick={onClose} variant="contained" size="small">
					Close
				</Button>
			</DialogActions>
		</Dialog>
	);
}

export default function SciencePayloadTable({
	sensors,
	asOfDate,
}: {
	sensors: ScienceSensorRecord[];
	asOfDate: string;
}) {
	const [expanded, setExpanded] = useState<Set<number>>(new Set());
	const [viewingConstants, setViewingConstants] =
		useState<ScienceSensorRecord | null>(null);

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
			<TableContainer component={Paper} variant="outlined">
				<Table size="small">
					<TableBody>
						<TableRow>
							<TableCell sx={{ color: "text.disabled" }}>
								No science sensors recorded for this glider as of{" "}
								{formatDate(asOfDate)}.
							</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			</TableContainer>
		);
	}

	return (
		<>
			<TableContainer component={Paper} variant="outlined">
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>Sensor</TableCell>
							<TableCell>Model</TableCell>
							<TableCell>Measured variables</TableCell>
							<TableCell>Serial number</TableCell>
							<TableCell>Calibration date</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{sensors.map((s) => {
							const isOpen = expanded.has(s.assetId);
							return (
								<Fragment key={s.assetId}>
									<TableRow
										hover
										onClick={() => toggle(s.assetId)}
										sx={{ cursor: "pointer" }}
									>
										<TableCell>{formatAssetType(s.assetType)}</TableCell>
										<TableCell>
											<Box
												sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
											>
												{s.model ?? "—"}
												{s.modelUri && (
													<Tooltip title="View NVS term">
														<MuiLink
															href={s.modelUri}
															target="_blank"
															rel="noreferrer"
															onClick={(e) => e.stopPropagation()}
															sx={{
																display: "inline-flex",
																color: "text.secondary",
															}}
														>
															<InfoOutlinedIcon sx={{ fontSize: 15 }} />
														</MuiLink>
													</Tooltip>
												)}
											</Box>
										</TableCell>
										<TableCell>
											{s.measuredParameters.length > 0
												? s.measuredParameters.map((p) => p.label).join(", ")
												: "—"}
										</TableCell>
										<TableCell sx={{ fontFamily: "monospace" }}>
											{s.serialNumber ?? "—"}
										</TableCell>
										<TableCell>
											<Box
												sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
											>
												{formatDate(s.calibration?.date ?? null)}
												<IconButton size="small" sx={{ p: 0.25 }}>
													<ExpandMoreIcon
														fontSize="small"
														sx={{
															transform: isOpen ? "rotate(180deg)" : "none",
															transition: "transform 0.15s",
														}}
													/>
												</IconButton>
											</Box>
										</TableCell>
									</TableRow>
									{isOpen && (
										<TableRow>
											<TableCell
												colSpan={5}
												sx={{ bgcolor: "action.hover", py: 2 }}
											>
												<Typography
													variant="caption"
													sx={{
														display: "inline-block",
														bgcolor: "info.main",
														color: "info.contrastText",
														px: 1.25,
														py: 0.5,
														borderRadius: 10,
														mb: 1.5,
													}}
												>
													As of {formatDate(asOfDate)} — the calibration in
													effect on this mission, not necessarily this sensor's
													latest
												</Typography>
												{s.calibration ? (
													<>
														<CoefficientGrid
															coefficients={s.calibration.coefficients}
														/>
														{s.assetType === "ct_sensor" && (
															<Button
																size="small"
																sx={{ mt: 1.5 }}
																onClick={(e) => {
																	e.stopPropagation();
																	setViewingConstants(s);
																}}
															>
																View sg_calib_constants.m
															</Button>
														)}
													</>
												) : (
													<Typography variant="body2" color="text.disabled">
														No calibration on record as of this date.
													</Typography>
												)}
											</TableCell>
										</TableRow>
									)}
								</Fragment>
							);
						})}
					</TableBody>
				</Table>
			</TableContainer>

			{viewingConstants?.calibration && (
				<SgCalibConstantsDialog
					coefficients={viewingConstants.calibration.coefficients}
					serialNumber={viewingConstants.serialNumber}
					onClose={() => setViewingConstants(null)}
				/>
			)}
		</>
	);
}
