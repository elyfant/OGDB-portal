"use client";

import { formatDate } from "@/lib/format";
import { KIND_META } from "@/lib/timeline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { ServicingEvent } from "@ogdb/types";

// Factory + in-house servicing only (transit stays out, same scope
// this table always had) -- shared by the glider Timeline tab's
// Servicing accordion and the asset detail page's, so a row click
// opens the same edit flow regardless of which page you're on. The
// caller owns the actual ServicingEventControls instance/ref; this
// component just reports which row was clicked.
export default function ServicingHistoryTable({
	events,
	canEdit,
	onEditEvent,
}: {
	events: ServicingEvent[];
	canEdit: boolean;
	onEditEvent: (event: ServicingEvent) => void;
}) {
	if (events.length === 0) {
		return (
			<Typography color="text.disabled">
				No factory or in-house servicing recorded.
			</Typography>
		);
	}

	return (
		<TableContainer>
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>Type</TableCell>
						<TableCell>Title</TableCell>
						<TableCell>Person</TableCell>
						<TableCell>Start</TableCell>
						<TableCell>End</TableCell>
						<TableCell>Document</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{events.map((e) => {
						const meta = KIND_META[e.eventType];
						return (
							<TableRow
								key={e.id}
								hover
								onClick={canEdit ? () => onEditEvent(e) : undefined}
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
								<TableCell>{e.title ?? "—"}</TableCell>
								<TableCell>{e.performedByName ?? "—"}</TableCell>
								<TableCell>{formatDate(e.startDate)}</TableCell>
								<TableCell>
									{e.endDate ? (
										formatDate(e.endDate)
									) : (
										<Chip size="small" label="Open" color="warning" />
									)}
								</TableCell>
								<TableCell>
									{e.documentId ? (
										<MuiLink
											href={`/api/documents/${e.documentId}/file`}
											target="_blank"
											rel="noreferrer"
											onClick={(evt) => evt.stopPropagation()}
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
						);
					})}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
