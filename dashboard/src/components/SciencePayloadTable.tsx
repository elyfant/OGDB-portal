"use client";

import { formatDate, formatFieldValue } from "@/lib/format";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Box from "@mui/material/Box";
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

export default function SciencePayloadTable({
	sensors,
	asOfDate,
}: {
	sensors: ScienceSensorRecord[];
	asOfDate: string;
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
		<TableContainer component={Paper} variant="outlined">
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>L22 Model</TableCell>
						<TableCell>Serial number</TableCell>
						<TableCell>Parameters</TableCell>
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
									<TableCell sx={{ fontFamily: "monospace" }}>
										{s.serialNumber ?? "—"}
									</TableCell>
									<TableCell>
										<Box
											sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
										>
											<Box component="span" sx={{ flex: 1 }}>
												{s.measuredParameters.length > 0
													? s.measuredParameters.map((p) => p.label).join(", ")
													: "—"}
											</Box>
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
											colSpan={3}
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
												As of {formatDate(asOfDate)} — the calibration in effect
												on this mission, not necessarily this sensor's latest
											</Typography>
											<Typography
												variant="caption"
												color="text.secondary"
												sx={{ display: "block", mb: 1 }}
											>
												Calibration date:{" "}
												{formatDate(s.calibration?.date ?? null)}
											</Typography>
											{s.calibration ? (
												<CoefficientGrid
													coefficients={s.calibration.coefficients}
												/>
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
	);
}
