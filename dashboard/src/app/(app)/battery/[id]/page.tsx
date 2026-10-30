import AddBatteryMeasurementDialog from "@/components/AddBatteryMeasurementDialog";
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
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { notFound, redirect } from "next/navigation";

// A weight/voltage value with the date it was measured as hover text.
function MeasuredValue({
	value,
	date,
}: {
	value: number | null | undefined;
	date: string | null | undefined;
}) {
	if (value == null) return <>—</>;
	return (
		<Tooltip title={date ? formatDate(date) : ""} placement="top-start">
			<span>{value.toLocaleString("en-GB")}</span>
		</Tooltip>
	);
}

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

	// measurements come back newest first, so the first non-null reading of
	// each kind is the current one (a voltage-only check leaves weight null
	// on that row, and vice versa).
	const latestWeight = battery.measurements.find((m) => m.weight !== null);
	const latestVoltage = battery.measurements.find((m) => m.voltage !== null);
	const { spec } = battery;

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
					<Box sx={{ display: "flex", gap: 1 }}>
						<AddBatteryMeasurementDialog assetId={asset.id} />
						<BatteryFormDialog
							mode="edit"
							asset={asset}
							battery={battery}
							institutes={institutes}
							batteryModels={batteryModels}
						/>
					</Box>
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
						value={
							<MeasuredValue
								value={latestWeight?.weight}
								date={latestWeight?.measuredDate}
							/>
						}
					/>
					<Field
						label="Voltage (V)"
						value={
							<MeasuredValue
								value={latestVoltage?.voltage}
								date={latestVoltage?.measuredDate}
							/>
						}
					/>
				</Box>
			</Paper>

			<Typography variant="h6" sx={{ mb: 0.5 }}>
				Specs
			</Typography>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
				Information about the battery model, shared by every pack of this model.
			</Typography>
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
					<Field label="Battery model" value={spec?.model} />
					<Field
						label="Manufacturer part number"
						value={spec?.manufacturerPartNumber}
					/>
					<Field label="Capacity (Ah)" value={spec?.capacity} />
					<Field label="Nominal voltage (V)" value={spec?.nominalVoltage} />
					<Field label="Energy (Wh)" value={spec?.wattHours} />
					<Field label="Chemistry" value={spec?.chemistry} />
					<Field label="UN classification" value={spec?.unClassification} />
					<Field label="Platform" value={spec?.platform} />
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
				historyChildren={
					<>
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
					</>
				}
			/>
		</Box>
	);
}
