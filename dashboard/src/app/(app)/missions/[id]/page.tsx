import Field from "@/components/Field";
import GliderBuildEditor from "@/components/GliderBuildEditor";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import StatTile from "@/components/StatTile";
import { getGliderBuild, getMission, getStatusOptions } from "@/lib/api";
import {
	formatAssetType,
	formatCount,
	formatDate,
	statusColor,
} from "@/lib/format";
import DatasetIcon from "@mui/icons-material/Dataset";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ScheduleIcon from "@mui/icons-material/Schedule";
import StraightenIcon from "@mui/icons-material/Straighten";
import WavesIcon from "@mui/icons-material/Waves";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { notFound } from "next/navigation";

const PLACEHOLDER_SECTIONS = [
	"Map of glider tracks",
	"Mission information",
	"Project information",
	"Piloting history",
	"Editing history",
];

function formatPosition(lat: number | null, lon: number | null): string {
	if (lat === null || lon === null) return "—";
	const latDir = lat >= 0 ? "N" : "S";
	const lonDir = lon >= 0 ? "E" : "W";
	return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`;
}

function EmptyTableNote({ colSpan, text }: { colSpan: number; text: string }) {
	return (
		<TableRow>
			<TableCell colSpan={colSpan} sx={{ color: "text.disabled" }}>
				{text}
			</TableCell>
		</TableRow>
	);
}

export default async function MissionDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const mission = await getMission(Number(id));
	if (!mission) notFound();

	const [gliderBuild, statusOptions] = await Promise.all([
		mission.gliderAssetId ? getGliderBuild(mission.gliderAssetId) : null,
		getStatusOptions(),
	]);

	const name =
		mission.stdMissionName ??
		mission.missionName ??
		`Mission ${mission.missionNumber ?? mission.id}`;

	return (
		<Box>
			<PageBreadcrumb
				catalogue="Missions"
				catalogueHref="/missions"
				current={name}
			/>

			<Box
				sx={{
					display: "flex",
					alignItems: "baseline",
					justifyContent: "space-between",
					flexWrap: "wrap",
					gap: 2,
					mb: 3,
				}}
			>
				<Typography variant="h5">Mission: {name}</Typography>
				<Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
					<MuiLink
						component={Link}
						href={`/datasets/${mission.id}`}
						sx={{
							display: "flex",
							alignItems: "center",
							gap: 0.75,
							fontWeight: 500,
						}}
					>
						<DatasetIcon fontSize="small" />
						View data processing status
					</MuiLink>
					{mission.status && (
						<Chip
							label={mission.status}
							color={statusColor(mission.status)}
							size="small"
						/>
					)}
				</Box>
			</Box>

			<Box sx={{ display: "flex", flexWrap: "wrap", gap: 2.5, mb: 4 }}>
				<StatTile
					label="Days in water"
					value={formatCount(mission.numberOfDays)}
					icon={ScheduleIcon}
					colorRole="yellow"
				/>
				<StatTile
					label="Total distance (km)"
					value={formatCount(mission.distanceKm)}
					icon={StraightenIcon}
					colorRole="aqua"
				/>
				<StatTile
					label="Total dives"
					value={formatCount(mission.dives)}
					icon={WavesIcon}
					colorRole="orange"
				/>
			</Box>

			<Typography variant="h6" sx={{ mb: 1.5 }}>
				About mission
			</Typography>
			<Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: {
							xs: "repeat(2, 1fr)",
							md: "repeat(6, 1fr)",
						},
						gap: 3,
					}}
				>
					<Field label="Site" value={mission.site} />
					<Field label="Project" value={mission.project} />
					<Field label="PI" value={mission.pi} />
					<Field label="Tech" value={mission.tech} />
					<Field label="Operating agency" value={mission.operatingAgency} />
					<Field label="Funding agency" value={mission.fundingAgency} />
				</Box>
			</Paper>

			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "1fr", md: "1.1fr 1fr" },
					gap: 3,
					mb: 4,
				}}
			>
				<Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
					<Box>
						<Typography variant="h6" sx={{ mb: 1.5 }}>
							Science payload
						</Typography>
						<TableContainer component={Paper} variant="outlined">
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell>Sensor</TableCell>
										<TableCell>Serial number</TableCell>
										<TableCell>Variables</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									<EmptyTableNote
										colSpan={3}
										text="Not yet available — sensor to variable linkage is pending."
									/>
								</TableBody>
							</Table>
						</TableContainer>
					</Box>

					<Box>
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								mb: 1.5,
							}}
						>
							<Typography variant="h6">Glider build</Typography>
							{mission.gliderAssetId && (
								<GliderBuildEditor
									gliderId={mission.gliderAssetId}
									components={gliderBuild?.components ?? []}
									statusOptions={statusOptions}
									missionId={mission.id}
									defaultDate={mission.launchDate?.slice(0, 10)}
								/>
							)}
						</Box>
						<TableContainer component={Paper} variant="outlined">
							<Table size="small">
								<TableHead>
									<TableRow>
										<TableCell>Asset</TableCell>
										<TableCell>Serial number</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{gliderBuild && gliderBuild.components.length > 0 ? (
										gliderBuild.components.map((c) => (
											<TableRow key={c.assignmentId}>
												<TableCell sx={{ pl: 2 + (c.depth - 1) * 2 }}>
													{formatAssetType(c.assetType)}
													{c.position ? ` (${c.position})` : ""}
												</TableCell>
												<TableCell>{c.serialNumber ?? "—"}</TableCell>
											</TableRow>
										))
									) : (
										<EmptyTableNote colSpan={2} text="Not yet available." />
									)}
								</TableBody>
							</Table>
						</TableContainer>
					</Box>
				</Box>

				<Box>
					<Typography variant="h6" sx={{ mb: 1.5 }}>
						Deployment
					</Typography>
					<Paper variant="outlined" sx={{ p: 3 }}>
						<Box sx={{ mb: 3 }}>
							<Typography
								variant="caption"
								color="text.secondary"
								display="block"
								sx={{ mb: 0.5 }}
							>
								Status
							</Typography>
							{mission.status ? (
								<Chip
									label={mission.status}
									color={statusColor(mission.status)}
									size="small"
								/>
							) : (
								<Typography color="text.disabled">—</Typography>
							)}
						</Box>
						<Box
							sx={{
								display: "grid",
								gridTemplateColumns: "1fr 1fr",
								gap: 3,
							}}
						>
							<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
								<Typography
									variant="overline"
									color="text.secondary"
									sx={{ letterSpacing: 1 }}
								>
									Deployment
								</Typography>
								<Field label="Date" value={formatDate(mission.launchDate)} />
								<Field
									label="Position"
									value={formatPosition(
										mission.launchLatitude,
										mission.launchLongitude,
									)}
								/>
								<Field
									label="Cruise"
									value={
										mission.launchCruiseId
											? `Cruise #${mission.launchCruiseId}`
											: null
									}
								/>
								<Field label="Vessel" value={null} />
							</Box>
							<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
								<Typography
									variant="overline"
									color="text.secondary"
									sx={{ letterSpacing: 1 }}
								>
									Recovery
								</Typography>
								<Field label="Date" value={formatDate(mission.recoveryDate)} />
								<Field
									label="Position"
									value={formatPosition(
										mission.recoveryLatitude,
										mission.recoveryLongitude,
									)}
								/>
								<Field
									label="Cruise"
									value={
										mission.recoveryCruiseId
											? `Cruise #${mission.recoveryCruiseId}`
											: null
									}
								/>
								<Field label="Vessel" value={null} />
							</Box>
						</Box>
					</Paper>
				</Box>
			</Box>

			<Box>
				{PLACEHOLDER_SECTIONS.map((title) => (
					<Accordion key={title} disableGutters>
						<AccordionSummary expandIcon={<ExpandMoreIcon />}>
							<Typography color="text.secondary">{title}</Typography>
						</AccordionSummary>
						<AccordionDetails>
							<Typography color="text.disabled">Not yet available.</Typography>
						</AccordionDetails>
					</Accordion>
				))}
			</Box>
		</Box>
	);
}
