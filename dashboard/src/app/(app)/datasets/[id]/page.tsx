import DatasetEditor from "@/components/DatasetEditor";
import DatasetHistoryTable from "@/components/DatasetHistoryTable";
import Field from "@/components/Field";
import { siteToArea } from "@/components/mission-stats/site-areas";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import ProcessingStatusTable from "@/components/ProcessingStatusTable";
import RegionIcon from "@/components/RegionIcon";
import {
	getDatasetProcessingDetail,
	getOgdbUsers,
	getProcessingPackages,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, statusColor } from "@/lib/format";
import RouteIcon from "@mui/icons-material/Route";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";

function ExternalRefRow({
	label,
	url,
	linkText,
	pushStatus,
}: {
	label: string;
	url: string | null;
	linkText: string;
	pushStatus?: "none" | "DM" | "PUB";
}) {
	return (
		<TableRow>
			<TableCell sx={{ color: "text.secondary" }}>{label}</TableCell>
			<TableCell
				align="right"
				sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1.5 }}
			>
				{url ? (
					<MuiLink href={url} target="_blank" rel="noreferrer">
						{linkText}
					</MuiLink>
				) : (
					<Typography color="text.disabled">not yet available</Typography>
				)}
				{pushStatus && pushStatus !== "none" && (
					<Chip
						size="small"
						label={pushStatus === "DM" ? "Delayed mode pushed" : "Published pushed"}
						color={pushStatus === "PUB" ? "success" : "default"}
					/>
				)}
			</TableCell>
		</TableRow>
	);
}

// DOI is an identifier (e.g. "10.1234/xyz"), not a URL -- shown as
// whatever was typed into the field, not wrapped in a link that would
// otherwise 404 against this app's own origin.
function TextRow({ label, value }: { label: string; value: string | null }) {
	return (
		<TableRow>
			<TableCell sx={{ color: "text.secondary" }}>{label}</TableCell>
			<TableCell align="right">
				{value ?? (
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

			<Paper
				variant="outlined"
				sx={{
					p: 3,
					mb: 3,
					display: "flex",
					alignItems: "center",
					gap: 3,
					flexWrap: "wrap",
				}}
			>
				<RegionIcon area={siteToArea(detail.site)} width={72} />
				<Box sx={{ flex: 1, minWidth: 220 }}>
					<Box
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 1.5,
							flexWrap: "wrap",
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
					<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
						{formatDate(detail.launchDate)} – {formatDate(detail.recoveryDate)}
					</Typography>
				</Box>
				<MuiLink
					component={Link}
					href={`/missions/${detail.missionId}`}
					sx={{
						display: "flex",
						alignItems: "center",
						gap: 0.75,
						fontWeight: 500,
					}}
				>
					<RouteIcon fontSize="small" />
					View mission details
				</MuiLink>
			</Paper>

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
				<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
					<MuiLink
						component={Link}
						href="/datasets/qc-pipeline"
						variant="body2"
					>
						NorGliders QC processing pipeline
					</MuiLink>
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
						<TextRow label="DOI" value={detail.doi} />
						<ExternalRefRow
							label="Ocean Ops Board (real-time data)"
							url={detail.oceanOpsBoardUrl}
							linkText="view record"
						/>
						<ExternalRefRow
							label="NorGliders ERDDAP L1 (timeseries)"
							url={detail.erddapL1Url}
							linkText="view dataset"
							pushStatus={detail.erddapL1Status}
						/>
						<ExternalRefRow
							label="NorGliders ERDDAP L2 (gridded)"
							url={detail.erddapL2Url}
							linkText="view dataset"
							pushStatus={detail.erddapL2Status}
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
			<DatasetHistoryTable history={detail.history} />
		</Box>
	);
}
