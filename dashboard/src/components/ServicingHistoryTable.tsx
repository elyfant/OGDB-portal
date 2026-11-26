"use client";

import EditRowButton from "@/components/EditRowButton";
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

// Every asset_service_events row this feature owns -- servicing, factory
// repair, transit, on loan, field test, missing, destroyed. Shared by the
// glider Timeline tab's Servicing accordion and the asset detail page's,
// so the spanner at the end of a row opens the same edit flow regardless of
// which page you're on. The row itself is not clickable. The caller owns the
// ServicingEventControls instance/ref; this component just reports which
// row's spanner was pressed.
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
		return <Typography color="text.disabled">No events recorded.</Typography>;
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
						{canEdit && <TableCell sx={{ width: 48 }} />}
					</TableRow>
				</TableHead>
				<TableBody>
					{events.map((e) => {
						const meta = KIND_META[e.eventType];
						return (
							<TableRow key={e.id}>
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
										<Chip
											size="small"
											label="Open"
											// Red for the two open events that are a problem, amber for
											// ordinary work in progress.
											color={
												e.eventType === "servicing_required" ||
												e.eventType === "missing"
													? "error"
													: "warning"
											}
										/>
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
											{e.documentName ?? "Document"}
										</MuiLink>
									) : (
										"—"
									)}
								</TableCell>
								{canEdit && (
									<TableCell align="right">
										<EditRowButton onClick={() => onEditEvent(e)} />
									</TableCell>
								)}
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
