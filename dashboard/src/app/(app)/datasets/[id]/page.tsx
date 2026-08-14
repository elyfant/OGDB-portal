import PageBreadcrumb from "@/components/PageBreadcrumb";
import ProcessingStatusTable from "@/components/ProcessingStatusTable";
import { getDatasetProcessingDetail } from "@/lib/api";
import { formatDate, statusColor } from "@/lib/format";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

function ExternalRefRow({
	label,
	url,
	linkText,
}: {
	label: string;
	url: string | null;
	linkText: string;
}) {
	return (
		<TableRow>
			<TableCell sx={{ color: "text.secondary" }}>{label}</TableCell>
			<TableCell align="right">
				{url ? (
					<Link href={url} target="_blank" rel="noreferrer">
						{linkText}
					</Link>
				) : (
					<Typography color="text.disabled">not yet available</Typography>
				)}
			</TableCell>
		</TableRow>
	);
}

export default async function DatasetDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const detail = await getDatasetProcessingDetail(Number(id));
	if (!detail) notFound();

	const title = detail.missionNumber
		? `${detail.missionNumber}. ${detail.missionName}`
		: detail.missionName;

	return (
		<Box>
			<PageBreadcrumb
				catalogue="Datasets"
				catalogueHref="/datasets"
				current={detail.missionName}
			/>
			<Box
				sx={{
					display: "flex",
					alignItems: "baseline",
					justifyContent: "space-between",
					mb: 2,
				}}
			>
				<Typography variant="h5">{title}</Typography>
				{detail.status && (
					<Chip
						label={detail.status}
						color={statusColor(detail.status)}
						size="small"
					/>
				)}
			</Box>

			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: "repeat(4, 1fr)",
					gap: 2,
					mb: 4,
				}}
			>
				<Box>
					<Typography variant="caption" color="text.secondary">
						Glider
					</Typography>
					<Typography>{detail.glider ?? "—"}</Typography>
				</Box>
				<Box>
					<Typography variant="caption" color="text.secondary">
						Site
					</Typography>
					<Typography>{detail.site ?? "—"}</Typography>
				</Box>
				<Box>
					<Typography variant="caption" color="text.secondary">
						Launch
					</Typography>
					<Typography>{formatDate(detail.launchDate)}</Typography>
				</Box>
				<Box>
					<Typography variant="caption" color="text.secondary">
						Recovery
					</Typography>
					<Typography>{formatDate(detail.recoveryDate)}</Typography>
				</Box>
			</Box>

			<Typography variant="h6" sx={{ mb: 1.5 }}>
				Processing status
			</Typography>
			<Box sx={{ mb: 4 }}>
				<ProcessingStatusTable stages={detail.stages} />
			</Box>

			<Typography variant="h6" sx={{ mb: 1.5 }}>
				External references
			</Typography>
			<TableContainer component={Paper} sx={{ mb: 4 }}>
				<Table size="small">
					<TableBody>
						<ExternalRefRow
							label="DOI"
							url={detail.doi}
							linkText="view record"
						/>
						<ExternalRefRow
							label="External data archive"
							url={detail.externalDataArchiveUrl}
							linkText="view archive"
						/>
						<ExternalRefRow
							label="Ocean Ops Board (real-time data)"
							url={detail.oceanOpsBoardUrl}
							linkText="view record"
						/>
						<ExternalRefRow
							label="Coriolis (real-time data)"
							url={detail.coriolisUrl}
							linkText="view record"
						/>
					</TableBody>
				</Table>
			</TableContainer>

			<Typography variant="h6" sx={{ mb: 1.5 }}>
				History
			</Typography>
			<TableContainer
				component={Paper}
				sx={{ maxHeight: 260, overflowY: "auto" }}
			>
				<Table size="small">
					<TableBody>
						{detail.history.length === 0 ? (
							<TableRow>
								<TableCell sx={{ color: "text.disabled" }}>
									No updates yet.
								</TableCell>
							</TableRow>
						) : (
							detail.history.map((entry, i) => (
								<TableRow key={`${entry.occurredAt}-${i}`}>
									<TableCell
										sx={{
											color: "text.secondary",
											whiteSpace: "nowrap",
											width: 180,
										}}
									>
										{formatDate(entry.occurredAt)}
									</TableCell>
									<TableCell>{entry.description}</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</TableContainer>
		</Box>
	);
}
