import DatasetEditor from "@/components/DatasetEditor";
import Field from "@/components/Field";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import ProcessingStatusTable from "@/components/ProcessingStatusTable";
import {
	getDatasetProcessingDetail,
	getOgdbUsers,
	getProcessingPackages,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
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
	const [detail, users, packages, currentUser] = await Promise.all([
		getDatasetProcessingDetail(Number(id)),
		getOgdbUsers(),
		getProcessingPackages(),
		getCurrentUser(),
	]);
	if (!detail) notFound();

	const currentOgdbUser = users.find((u) => u.id === currentUser?.id);

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

			<Typography variant="h6" sx={{ mb: 1.5 }}>
				About dataset
			</Typography>
			<Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: {
							xs: "repeat(2, 1fr)",
							md: "repeat(4, 1fr)",
						},
						gap: 3,
					}}
				>
					<Field label="Glider" value={detail.glider} />
					<Field label="Site" value={detail.site} />
					<Field label="Launch" value={formatDate(detail.launchDate)} />
					<Field label="Recovery" value={formatDate(detail.recoveryDate)} />
				</Box>
			</Paper>

			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					mb: 1.5,
				}}
			>
				<Typography variant="h6">Processing status</Typography>
				<DatasetEditor
					missionId={detail.missionId}
					detail={detail}
					users={users}
					packages={packages}
					currentUser={
						currentOgdbUser
							? {
									contactId: currentOgdbUser.contactId,
									name: currentOgdbUser.name,
								}
							: null
					}
				/>
			</Box>
			<Box sx={{ mb: 4 }}>
				<ProcessingStatusTable stages={detail.stages} />
			</Box>

			<Typography variant="h6" sx={{ mb: 1.5 }}>
				External references
			</Typography>
			<TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
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
				variant="outlined"
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
