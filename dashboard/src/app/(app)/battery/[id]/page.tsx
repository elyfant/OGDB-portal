import AssetChangeLog from "@/components/AssetChangeLog";
import AssetServicingTimeline from "@/components/AssetServicingTimeline";
import AssetStatusHistoryTable from "@/components/AssetStatusHistoryTable";
import BatteryFormDialog from "@/components/BatteryFormDialog";
import Field from "@/components/Field";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import {
	getAsset,
	getAssetBattery,
	getAssetChanges,
	getAssetMissions,
	getAssetStatusHistory,
	getBatteryModels,
	getContacts,
	getInstitutes,
	getServicingEventTypes,
	getServicingEvents,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status-meta";
import {
	type TimelineEvent,
	deploymentToTimelineEvent,
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

// A battery is an asset (asset_type "battery", same id) but gets its own
// page: the asset page minus the sections that don't apply (RMA cases,
// calibrations, the per-type details dump) plus the battery spec in the
// About card.
export default async function BatteryDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const asset = await getAsset(Number(id));
	if (!asset) notFound();

	// /battery/{id} for a non-battery asset: send it to where it belongs.
	if (asset.assetType !== "battery") {
		redirect(
			asset.assetType === "glider"
				? `/gliders/${asset.id}`
				: `/assets/${asset.id}`,
		);
	}

	const [
		battery,
		servicingEvents,
		missions,
		eventTypes,
		contacts,
		institutes,
		batteryModels,
		statusHistory,
		changes,
		user,
	] = await Promise.all([
		getAssetBattery(asset.id),
		getServicingEvents(asset.id),
		getAssetMissions(asset.id),
		getServicingEventTypes(),
		getContacts(),
		getInstitutes(),
		getBatteryModels(),
		getAssetStatusHistory(asset.id),
		getAssetChanges(asset.id),
		getCurrentUser(),
	]);
	const canEdit = user?.role === "editor" || user?.role === "admin";

	const events: TimelineEvent[] = [
		...servicingEvents.map(servicingEventToTimelineEvent),
		...missions.map(deploymentToTimelineEvent).filter((e) => e !== null),
	];

	// measurements come back newest first, so [0] is the current weight.
	const currentWeight = battery.measurements.find(
		(m) => m.weight !== null,
	)?.weight;

	return (
		<Box>
			<PageBreadcrumb
				catalogue="Batteries"
				catalogueHref="/batteries"
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
				<Typography variant="h5">
					{asset.serialNumber ? `Battery: SN ${asset.serialNumber}` : "Battery"}
				</Typography>
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
				<Typography variant="h6">About battery</Typography>
				{canEdit && (
					<BatteryFormDialog
						mode="edit"
						asset={asset}
						battery={battery}
						institutes={institutes}
						batteryModels={batteryModels}
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
					<Field label="Institute" value={battery.institute} />
					<Field label="Battery model" value={battery.batteryModel} />
					<Field
						label="Date of manufacture"
						value={formatDate(battery.dateOfManufacture)}
					/>
					<Field label="Purchase date" value={formatDate(asset.purchaseDate)} />
					<Field
						label="Purchase value"
						value={formatMoney(asset.purchaseValue, asset.purchaseCurrency)}
					/>
					<Field
						label="Weight (g)"
						value={currentWeight == null ? null : String(currentWeight)}
					/>
				</Box>
			</Paper>

			<Typography variant="h6" sx={{ mb: 1.5 }}>
				Timeline
			</Typography>
			<AssetServicingTimeline
				assetId={asset.id}
				events={events}
				servicingEvents={servicingEvents}
				rmas={null}
				hiddenKinds={["calibration", "rma", "transit"]}
				eventTypes={eventTypes}
				contacts={contacts}
				canEdit={canEdit}
				decommissionedDate={asset.decommissionedDate}
				decommissionReason={asset.decommissionReason}
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
