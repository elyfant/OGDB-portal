"use client";

import { formatAssetType, formatDate, formatFieldValue } from "@/lib/format";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type {
	CalibrationCatalogueModelGroup,
	CalibrationCatalogueRow,
	CalibrationCatalogueTypeGroup,
} from "@ogdb/types";
import { Fragment, useMemo, useState } from "react";

function buildCopyText(row: CalibrationCatalogueRow): string {
	const lines = [
		`serial_number=${row.serialNumber ?? ""}`,
		`cal_date=${row.calDate}`,
		`facility=${row.facility ?? ""}`,
	];
	for (const [key, value] of Object.entries(row.coefficients)) {
		if (value === null || value === undefined) continue;
		lines.push(`${key}=${value}`);
	}
	return lines.join("\n");
}

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

type SortKey = "serialNumber" | "calDate" | "facility";

function ModelCalibrationTable({ rows }: { rows: CalibrationCatalogueRow[] }) {
	const [expanded, setExpanded] = useState<Set<number>>(new Set());
	const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
		key: "calDate",
		dir: "desc",
	});

	const sorted = useMemo(() => {
		const copy = [...rows];
		copy.sort((a, b) => {
			const av = a[sort.key] ?? "";
			const bv = b[sort.key] ?? "";
			const cmp = String(av).localeCompare(String(bv));
			return sort.dir === "asc" ? cmp : -cmp;
		});
		return copy;
	}, [rows, sort]);

	function toggleSort(key: SortKey) {
		setSort((prev) =>
			prev.key === key
				? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
				: { key, dir: "asc" },
		);
	}

	function toggleRow(id: number) {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	async function copyRow(row: CalibrationCatalogueRow) {
		await navigator.clipboard.writeText(buildCopyText(row));
	}

	return (
		<TableContainer component={Box}>
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>
							<TableSortLabel
								active={sort.key === "serialNumber"}
								direction={sort.key === "serialNumber" ? sort.dir : "asc"}
								onClick={() => toggleSort("serialNumber")}
							>
								Serial number
							</TableSortLabel>
						</TableCell>
						<TableCell>
							<TableSortLabel
								active={sort.key === "calDate"}
								direction={sort.key === "calDate" ? sort.dir : "asc"}
								onClick={() => toggleSort("calDate")}
							>
								Calibration date
							</TableSortLabel>
						</TableCell>
						<TableCell>
							<TableSortLabel
								active={sort.key === "facility"}
								direction={sort.key === "facility" ? sort.dir : "asc"}
								onClick={() => toggleSort("facility")}
							>
								Facility
							</TableSortLabel>
						</TableCell>
						<TableCell>Certificates</TableCell>
						<TableCell style={{ width: 1 }} />
					</TableRow>
				</TableHead>
				<TableBody>
					{sorted.map((row) => {
						const isOpen = expanded.has(row.id);
						return (
							<Fragment key={row.id}>
								<TableRow
									hover
									onClick={() => toggleRow(row.id)}
									sx={{ cursor: "pointer" }}
								>
									<TableCell sx={{ fontFamily: "monospace" }}>
										{row.serialNumber ?? "—"}
									</TableCell>
									<TableCell>
										<Box
											sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
										>
											{formatDate(row.calDate)}
											<ExpandMoreIcon
												fontSize="small"
												sx={{
													color: "text.disabled",
													transform: isOpen ? "rotate(180deg)" : "none",
													transition: "transform 0.15s",
												}}
											/>
										</Box>
									</TableCell>
									<TableCell>{row.facility ?? "—"}</TableCell>
									<TableCell>
										<Tooltip title="Not connected yet">
											<Chip
												label="—"
												size="small"
												variant="outlined"
												sx={{ color: "text.disabled" }}
											/>
										</Tooltip>
									</TableCell>
									<TableCell>
										<Tooltip title="Copy all coefficients">
											<IconButton
												size="small"
												onClick={(e) => {
													e.stopPropagation();
													copyRow(row);
												}}
											>
												<ContentCopyIcon fontSize="small" />
											</IconButton>
										</Tooltip>
									</TableCell>
								</TableRow>
								{isOpen && (
									<TableRow>
										<TableCell
											colSpan={5}
											sx={{ bgcolor: "action.hover", py: 2 }}
										>
											<CoefficientGrid coefficients={row.coefficients} />
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

function ModelSection({ group }: { group: CalibrationCatalogueModelGroup }) {
	return (
		<Box sx={{ mb: 2.5 }}>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					gap: 0.75,
					bgcolor: "action.hover",
					borderRadius: 1,
					px: 1.25,
					py: 0.75,
					mb: 1,
				}}
			>
				<Typography
					variant="body2"
					sx={{
						fontWeight: 600,
						fontStyle: group.model ? "normal" : "italic",
						color: group.model ? "text.primary" : "text.secondary",
					}}
				>
					{group.model ?? "Unspecified model"}
				</Typography>
				{group.modelUri && (
					<Tooltip title="View NVS term">
						<MuiLink
							href={group.modelUri}
							target="_blank"
							rel="noreferrer"
							sx={{ display: "inline-flex", color: "text.secondary" }}
						>
							<InfoOutlinedIcon sx={{ fontSize: 15 }} />
						</MuiLink>
					</Tooltip>
				)}
			</Box>
			<ModelCalibrationTable rows={group.rows} />
		</Box>
	);
}

export default function CalibrationsCatalogue({
	data,
}: {
	data: CalibrationCatalogueTypeGroup[];
}) {
	return (
		<Box>
			{data.map((group, index) => {
				const recordCount = group.models.reduce(
					(sum, m) => sum + m.rows.length,
					0,
				);
				return (
					<Accordion key={group.assetType} defaultExpanded={index === 0}>
						<AccordionSummary expandIcon={<ExpandMoreIcon />}>
							<Box
								sx={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									width: "100%",
									pr: 2,
								}}
							>
								<Typography sx={{ fontWeight: 700 }}>
									{formatAssetType(group.assetType)}
								</Typography>
								<Typography variant="caption" color="text.secondary">
									{recordCount === 0
										? "No calibration records yet"
										: `${group.models.length} model${group.models.length === 1 ? "" : "s"} · ${recordCount} calibration record${recordCount === 1 ? "" : "s"}`}
								</Typography>
							</Box>
						</AccordionSummary>
						<AccordionDetails>
							{group.models.length === 0 ? (
								<Typography color="text.disabled" variant="body2">
									Not yet available.
								</Typography>
							) : (
								group.models.map((m) => (
									<ModelSection key={m.modelId ?? "unspecified"} group={m} />
								))
							)}
						</AccordionDetails>
					</Accordion>
				);
			})}
		</Box>
	);
}
