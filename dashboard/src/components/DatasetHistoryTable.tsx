"use client";

import { formatHistoryTimestamp } from "@/lib/format";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import type { DatasetHistoryEntry } from "@ogdb/types";
import { Fragment, useState } from "react";

// dataset_processing_stages is append-only, so every history row is a
// full snapshot at that point (not a diff) -- version/OG1/QC/processing
// notes are all part of it, just too much for a one-line row, so they're
// tucked behind an expand affordance instead.
function hasDetail(entry: DatasetHistoryEntry): boolean {
	return Boolean(
		entry.versionLabel || entry.isOg1 !== null || entry.qcDone !== null ||
			entry.processingNotes,
	);
}

function DetailRow({ entry }: { entry: DatasetHistoryEntry }) {
	return (
		<TableRow>
			<TableCell colSpan={3} sx={{ py: 0, borderBottom: "none" }}>
				<Collapse in>
					<Box
						sx={{
							py: 1.5,
							pl: 4,
							bgcolor: "action.hover",
							display: "flex",
							flexDirection: "column",
							gap: 1,
						}}
					>
						<Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
							{entry.versionLabel && (
								<Typography variant="body2" color="text.secondary">
									Version: {entry.versionLabel}
								</Typography>
							)}
							{entry.isOg1 !== null && (
								<Typography variant="body2" color="text.secondary">
									OG1 format: {entry.isOg1 ? "yes" : "no"}
								</Typography>
							)}
							{entry.qcDone !== null && (
								<Typography variant="body2" color="text.secondary">
									Manual QC: {entry.qcDone ? "done" : "not done"}
								</Typography>
							)}
						</Box>
						{entry.processingNotes && (
							<Typography
								variant="body2"
								color="text.secondary"
								sx={{ whiteSpace: "pre-wrap" }}
							>
								{entry.processingNotes}
							</Typography>
						)}
					</Box>
				</Collapse>
			</TableCell>
		</TableRow>
	);
}

export default function DatasetHistoryTable({
	history,
}: {
	history: DatasetHistoryEntry[];
}) {
	const [expanded, setExpanded] = useState<Set<number>>(new Set());

	function toggle(i: number) {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(i)) next.delete(i);
			else next.add(i);
			return next;
		});
	}

	return (
		<TableContainer
			component={Paper}
			variant="outlined"
			sx={{ maxHeight: 320, overflowY: "auto" }}
		>
			<Table size="small">
				<TableBody>
					{history.length === 0 ? (
						<TableRow>
							<TableCell sx={{ color: "text.disabled" }}>
								No updates yet.
							</TableCell>
						</TableRow>
					) : (
						history.map((entry, i) => {
							const expandable = hasDetail(entry);
							return (
								<Fragment key={`${entry.occurredAt}-${i}`}>
									<TableRow
										hover={expandable}
										onClick={expandable ? () => toggle(i) : undefined}
										sx={expandable ? { cursor: "pointer" } : undefined}
									>
										<TableCell
											sx={{
												color: "text.secondary",
												whiteSpace: "nowrap",
												width: 190,
											}}
										>
											{formatHistoryTimestamp(entry.occurredAt)}
										</TableCell>
										<TableCell>{entry.description}</TableCell>
										<TableCell align="right" sx={{ width: 40, py: 0 }}>
											{expandable && (
												<IconButton
												size="small"
												onClick={(e) => {
													e.stopPropagation();
													toggle(i);
												}}
											>
													{expanded.has(i) ? (
														<KeyboardArrowUpIcon fontSize="small" />
													) : (
														<KeyboardArrowDownIcon fontSize="small" />
													)}
												</IconButton>
											)}
										</TableCell>
									</TableRow>
									{expandable && expanded.has(i) && <DetailRow entry={entry} />}
								</Fragment>
							);
						})
					)}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
