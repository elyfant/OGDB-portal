import AssetFormDialog from "@/components/AssetFormDialog";
import AssetTimelineSection from "@/components/AssetTimelineSection";
import Field from "@/components/Field";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import ServicingEventControls from "@/components/ServicingEventControls";
import {
	getAsset,
	getAssetCalibrations,
	getAssetTypes,
	getContacts,
	getSensorModels,
	getServicingEventTypes,
	getServicingEvents,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatAssetType, formatDate, formatUsd } from "@/lib/format";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status-meta";
import {
	type TimelineEvent,
	servicingEventToTimelineEvent,
} from "@/lib/timeline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { notFound, redirect } from "next/navigation";

const PLACEHOLDER_SECTIONS = [
	"Calibration information",
	"Operational history",
	"Editing history",
];

function calibrationToTimelineEvent(row: {
	id: number;
	assetType: string;
	facility: string | null;
	notes: string | null;
	certificateDocumentId: number | null;
	calDate: string;
}): TimelineEvent {
	return {
		id: `cal-${row.id}`,
		kind: "calibration",
		label: `${formatAssetType(row.assetType)} calibration`,
		detail: row.facility ?? "",
		notes: row.notes,
		documentId: row.certificateDocumentId,
		startDate: row.calDate,
		endDate: null,
		instant: true,
	};
}

export default async function AssetDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const asset = await getAsset(Number(id));
	if (!asset) notFound();

	// Gliders are assets too, but live under Fleet's own detail page —
	// keep a direct /assets/{id} visit consistent with the double-click
	// routing on the Assets catalogue.
	if (asset.assetType === "glider") {
		redirect(`/gliders/${asset.id}`);
	}

	const [
		calibrations,
		servicingEvents,
		eventTypes,
		contacts,
		assetTypes,
		sensorModels,
		user,
	] = await Promise.all([
		getAssetCalibrations(asset.id),
		getServicingEvents(asset.id),
		getServicingEventTypes(),
		getContacts(),
		getAssetTypes(),
		getSensorModels(),
		getCurrentUser(),
	]);
	const canEdit = user?.role === "editor" || user?.role === "admin";

	// No asset-scoped "which missions was this on" query exists yet for
	// non-glider assets (see the schema audit) -- the Missions chip/kind
	// stays in the timeline for consistency with the glider version, it
	// just always reads 0 until that's built.
	const events: TimelineEvent[] = [
		...calibrations.map(calibrationToTimelineEvent),
		...servicingEvents.map(servicingEventToTimelineEvent),
	];

	const name = asset.name ?? asset.serialNumber ?? `Asset ${asset.id}`;

	return (
		<Box>
			<PageBreadcrumb
				catalogue="Assets"
				catalogueHref="/assets"
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
				<Typography variant="h5">Asset: {name}</Typography>
				{asset.status && (
					<Chip
						label={STATUS_LABEL[asset.status]}
						color={STATUS_COLOR[asset.status]}
						size="small"
					/>
				)}
			</Box>

			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					mb: 1.5,
				}}
			>
				<Typography variant="h6">About asset</Typography>
				{canEdit && (
					<AssetFormDialog
						mode="edit"
						asset={asset}
						assetTypes={assetTypes}
						sensorModels={sensorModels}
					/>
				)}
			</Box>
			<Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
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
					<Field label="Serial number" value={asset.serialNumber} />
					<Field
						label="Asset type"
						value={asset.assetType.replaceAll("_", " ")}
					/>
					<Field label="Asset type group" value={asset.assetTypeGroup} />
					<Field label="Asset model" value={asset.assetModel} />
					<Field label="Platform model" value={asset.platformModelFull} />
					<Field label="Platform category" value={asset.platformCategory} />
					<Field label="Purchase date" value={formatDate(asset.purchaseDate)} />
					<Field
						label="Purchase value"
						value={formatUsd(asset.purchaseValueUsd)}
					/>
				</Box>
			</Paper>

			<Typography variant="h6" sx={{ mb: 1.5 }}>
				Timeline
			</Typography>
			<ServicingEventControls
				assetId={asset.id}
				servicingEvents={servicingEvents}
				eventTypes={eventTypes}
				contacts={contacts}
				canEdit={canEdit}
			/>

			<AssetTimelineSection events={events} />

			<Typography variant="h6" sx={{ mt: 4, mb: 1.5 }}>
				History
			</Typography>
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
