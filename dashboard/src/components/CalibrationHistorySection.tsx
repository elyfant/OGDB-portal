"use client";

import CalibrationFormDialog from "@/components/CalibrationFormDialog";
import { formatDate } from "@/lib/format";
import { KIND_META } from "@/lib/timeline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { CalibrationCatalogueRow } from "@ogdb/types";
import { useState } from "react";

// The Calibrations counterpart to AssetServicingTimeline's Servicing
// accordion, same style: a row click opens the same edit dialog the
// /calibrations catalogue uses (CalibrationFormDialog's edit mode is
// already externally controlled via row/onClose, so no ref/imperative
// handle is needed the way ServicingEventControls needed one).
export default function CalibrationHistorySection({
	calibrations,
	canEdit,
}: {
	calibrations: CalibrationCatalogueRow[];
	canEdit: boolean;
}) {
	const [editingRow, setEditingRow] = useState<CalibrationCatalogueRow | null>(
		null,
	);
	const meta = KIND_META.calibration;

	return (
		<Accordion disableGutters sx={{ mt: 2 }}>
			<AccordionSummary expandIcon={<ExpandMoreIcon />}>
				<Typography color="text.secondary">Calibrations</Typography>
			</AccordionSummary>
			<AccordionDetails>
				{calibrations.length === 0 ? (
					<Typography color="text.disabled">
						No calibrations recorded.
					</Typography>
				) : (
					<TableContainer>
						<Table size="small">
							<TableHead>
								<TableRow>
									<TableCell>Type</TableCell>
									<TableCell>Facility</TableCell>
									<TableCell>Date</TableCell>
									<TableCell>Document</TableCell>
								</TableRow>
							</TableHead>
							<TableBody>
								{calibrations.map((row) => (
									<TableRow
										key={row.id}
										hover
										onClick={canEdit ? () => setEditingRow(row) : undefined}
										sx={canEdit ? { cursor: "pointer" } : undefined}
									>
										<TableCell>
											<Chip
												size="small"
												label={meta.label}
												sx={{
													backgroundColor: meta.fill,
													color: meta.color,
													fontWeight: 600,
												}}
											/>
										</TableCell>
										<TableCell>{row.facility ?? "—"}</TableCell>
										<TableCell>{formatDate(row.calDate)}</TableCell>
										<TableCell>
											{row.certificateDocumentId ? (
												<MuiLink
													href={`/api/documents/${row.certificateDocumentId}/file`}
													target="_blank"
													rel="noreferrer"
													onClick={(e) => e.stopPropagation()}
													sx={{
														display: "inline-flex",
														alignItems: "center",
														gap: 0.5,
														fontSize: 12.5,
													}}
												>
													<OpenInNewIcon sx={{ fontSize: 14 }} />
													PDF
												</MuiLink>
											) : (
												"—"
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</TableContainer>
				)}
			</AccordionDetails>

			<CalibrationFormDialog
				mode="edit"
				row={editingRow}
				onClose={() => setEditingRow(null)}
			/>
		</Accordion>
	);
}
