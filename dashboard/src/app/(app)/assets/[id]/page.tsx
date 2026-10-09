import AssetChangeLog from "@/components/AssetChangeLog";
import AssetDetailsSection from "@/components/AssetDetailsSection";
import AssetFormDialog from "@/components/AssetFormDialog";
import AssetServicingTimeline from "@/components/AssetServicingTimeline";
import AssetStatusHistoryTable from "@/components/AssetStatusHistoryTable";
import BatteryDetailsSection from "@/components/BatteryDetailsSection";
import CalibrationHistorySection from "@/components/CalibrationHistorySection";
import Field from "@/components/Field";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import {
	getAsset,
	getAssetBattery,
	getAssetCalibrations,
	getAssetChanges,
	getAssetDetails,
	getAssetMissions,
	getAssetRmas,
	getAssetStatusHistory,
	getAssetTypes,
	getContacts,
	getSensorModels,
	getServicingEventTypes,
	getServicingEvents,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatAssetType, formatDate, formatMoney } from "@/lib/format";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status-meta";
import {
	type TimelineEvent,
	deploymentToTimelineEvent,
	rmaToTimelineEvent,
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

function calibrationToTimelineEvent(row: {
	id: number;
	assetType: string;
	facility: string | null;
	notes: string | null;
	certificateDocumentId: number | null;
	certificateDocumentName: string | null;
	calDate: string;
}): TimelineEvent {
	return {
		id: `cal-${row.id}`,
		kind: "calibration",
		label: `${formatAssetType(row.assetType)} calibration`,
		detail: row.facility ?? "",
		notes: row.notes,
		documentId: row.certificateDocumentId,
		documentName: row.certificateDocumentName,
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
		missions,
		rmas,
		eventTypes,
		contacts,
		assetTypes,
		sensorModels,
		details,
		statusHistory,
		changes,
		user,
	] = await Promise.all([
		getAssetCalibrations(asset.id),
		getServicingEvents(asset.id),
		getAssetMissions(asset.id),
		getAssetRmas(asset.id),
		getServicingEventTypes(),
		getContacts(),
		getAssetTypes(),
		getSensorModels(),
		getAssetDetails(asset.id),
		getAssetStatusHistory(asset.id),
		getAssetChanges(asset.id),
		getCurrentUser(),
	]);
	const canEdit = user?.role === "editor" || user?.role === "admin";

	// Battery-type assets get a read-only "Battery details" accordion
	// (model + manufacture date + measurement history) -- the generic
	// asset detail grid has no source for those.
	const battery =
		asset.assetType === "battery" ? await getAssetBattery(asset.id) : null;

	// GET /assets/:id/missions reads asset_assignments.mission_id directly
	// -- only populated for assignments made through GliderBuildEditor
	// (see MissionsService.getForAsset), so an asset whose only history is
	// the original pre-app backfill shows no missions here yet.
	const events: TimelineEvent[] = [
		...calibrations.map(calibrationToTimelineEvent),
		...servicingEvents.map(servicingEventToTimelineEvent),
		...missions.map(deploymentToTimelineEvent).filter((e) => e !== null),
		...rmas.map(rmaToTimelineEvent),
	];

	// Title: "Slocum aft section SN:1015". Equipment is identified by its
	// own name ("Argos goniometer") rather than the generic type word.
	const typeLabel =
		asset.assetType === "equipment" && asset.name
			? asset.name
			: asset.assetType
					.replaceAll("_", " ")
					.replace(/^./, (c) => c.toUpperCase());
	const title = asset.serialNumber
		? `${typeLabel} SN:${asset.serialNumber}`
		: typeLabel;

	return (
		<Box>
			<PageBreadcrumb
				catalogue="Assets"
				catalogueHref="/assets"
				current={String(asset.id)}
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
				<Typography variant="h5">Asset: {title}</Typography>
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
					<Field label="Purchase date" value={formatDate(asset.purchaseDate)} />
					<Field
						label="Purchase value"
						value={formatMoney(asset.purchaseValue, asset.purchaseCurrency)}
					/>
				</Box>
			</Paper>

			<AssetDetailsSection details={details} />

			<Typography variant="h6" sx={{ mb: 1.5 }}>
				Timeline
			</Typography>
			<AssetServicingTimeline
				assetId={asset.id}
				events={events}
				servicingEvents={servicingEvents}
				rmas={rmas}
				eventTypes={eventTypes}
				contacts={contacts}
				canEdit={canEdit}
				decommissionedDate={asset.decommissionedDate}
				decommissionReason={asset.decommissionReason}
			/>
			{battery && <BatteryDetailsSection battery={battery} />}
			<CalibrationHistorySection
				calibrations={calibrations}
				canEdit={canEdit}
			/>

			<Typography variant="h6" sx={{ mt: 4, mb: 1.5 }}>
				History
			</Typography>
			<Box>
				<Accordion disableGutters>
					<AccordionSummary expandIcon={<ExpandMoreIcon />}>
						<Typography color="text.secondary">Status history</Typography>
					</AccordionSummary>
					<AccordionDetails>
						<AssetStatusHistoryTable entries={statusHistory} />
					</AccordionDetails>
				</Accordion>
				<Accordion disableGutters>
					<AccordionSummary expandIcon={<ExpandMoreIcon />}>
						<Typography color="text.secondary">Change log</Typography>
					</AccordionSummary>
					<AccordionDetails>
						<AssetChangeLog changes={changes} />
					</AccordionDetails>
				</Accordion>
			</Box>
		</Box>
	);
}
