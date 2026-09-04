import Field from "@/components/Field";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import RmaDetail from "@/components/RmaDetail";
import RmaFormDialog from "@/components/RmaFormDialog";
import {
	getAssetTypes,
	getManufacturers,
	getRma,
	getRmaAssets,
	getRmaEvents,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { formatRmaStage } from "@/lib/rma-columns";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

const PLACEHOLDER_SECTIONS = ["Editing history"];

export default async function RmaDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const rma = await getRma(Number(id));
	if (!rma) notFound();

	const [assets, events, assetTypes, manufacturers, user] = await Promise.all([
		getRmaAssets(rma.id),
		getRmaEvents(rma.id),
		getAssetTypes(),
		getManufacturers(),
		getCurrentUser(),
	]);
	const canEdit = user?.role === "editor" || user?.role === "admin";

	// current_rma_status, computed here from the same events list the
	// page already fetched rather than a second round-trip -- the
	// latest event by date is the case's current stage; "closed" means
	// closed, anything else means open. Same derive-don't-store
	// philosophy as the rest of this feature.
	const latestEvent = [...events].sort(
		(a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime(),
	)[0];
	const currentStage = latestEvent?.eventType ?? "opened";
	const open = currentStage !== "closed";

	const name = rma.rmaNumber ?? `RMA ${rma.id}`;

	return (
		<Box>
			<PageBreadcrumb catalogue="RMAs" catalogueHref="/rmas" current={name} />

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
				<Typography variant="h5">RMA: {name}</Typography>
				<Chip
					label={`${formatRmaStage(currentStage)}${open ? "" : " (closed)"}`}
					color={open ? "warning" : "success"}
					size="small"
				/>
			</Box>

			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					mb: 1.5,
				}}
			>
				<Typography variant="h6">About RMA</Typography>
				{canEdit && (
					<RmaFormDialog mode="edit" rma={rma} manufacturers={manufacturers} />
				)}
			</Box>
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
					<Field label="RMA number" value={rma.rmaNumber} />
					<Field label="Manufacturer" value={rma.manufacturerName} />
					<Field label="Opened" value={formatDate(rma.openedDate)} />
					<Field label="Notes" value={rma.notes} />
				</Box>
			</Paper>

			<RmaDetail
				rmaId={rma.id}
				assets={assets}
				events={events}
				assetTypes={assetTypes}
				manufacturers={manufacturers}
				canEdit={canEdit}
			/>

			<Box sx={{ mt: 4 }}>
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
