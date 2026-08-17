import Field from "@/components/Field";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { getGlider } from "@/lib/api";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status-meta";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

const PLACEHOLDER_SECTIONS = [
	"Platform information",
	"Science payload",
	"Servicing history",
	"Editing history",
];

function ComingSoonCard({ title }: { title: string }) {
	return (
		<Box
			sx={{
				border: "1px dashed",
				borderColor: "divider",
				borderRadius: 2,
				px: 3,
				py: 2.5,
				mb: 2.5,
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
			}}
		>
			<Typography variant="h6" color="text.secondary">
				{title}
			</Typography>
			<Typography variant="body2" color="text.disabled">
				coming soon
			</Typography>
		</Box>
	);
}

export default async function GliderDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const glider = await getGlider(Number(id));
	if (!glider) notFound();

	return (
		<Box>
			<PageBreadcrumb
				catalogue="Fleet"
				catalogueHref="/gliders"
				current={glider.name}
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
				<Typography variant="h5">Glider: {glider.name}</Typography>
				{glider.status && (
					<Chip
						label={STATUS_LABEL[glider.status]}
						color={STATUS_COLOR[glider.status]}
						size="small"
					/>
				)}
			</Box>

			<Typography variant="h6" sx={{ mb: 1.5 }}>
				About glider
			</Typography>
			<Paper variant="outlined" sx={{ p: 3, mb: 2.5 }}>
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
					<Field label="WMO" value={glider.wmo} />
					<Field label="Nickname" value={glider.name} />
					<Field label="Serial number" value={glider.serialNumber} />
					<Field label="Platform maker" value={null} />
					<Field label="Platform model" value={glider.platformModelFull} />
					<Field label="Transmission system" value={null} />
					<Field label="Owner" value={glider.owner} />
					<Field label="Purchased" value={null} />
				</Box>
			</Paper>

			<ComingSoonCard title="Current build" />
			<ComingSoonCard title="Status" />

			<Box sx={{ mt: 1.5 }}>
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
