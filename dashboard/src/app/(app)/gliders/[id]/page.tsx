import Field from "@/components/Field";
import GliderCurrentBuild from "@/components/GliderCurrentBuild";
import GliderEditHistory from "@/components/GliderEditHistory";
import GliderSciencePayload from "@/components/GliderSciencePayload";
import GliderServicingHistory from "@/components/GliderServicingHistory";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { getGlider, getGliderBuild } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status-meta";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

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

// Links a displayed value out to the NVS term it came from — only
// rendered when a real URI exists, never a dead icon.
function NvsValue({ text, uri }: { text: ReactNode; uri: string | null }) {
	return (
		<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
			{text}
			{uri && (
				<MuiLink
					href={uri}
					target="_blank"
					rel="noreferrer"
					sx={{ display: "inline-flex", color: "text.secondary" }}
				>
					<InfoOutlinedIcon sx={{ fontSize: 16 }} />
				</MuiLink>
			)}
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
	const build = await getGliderBuild(Number(id));

	const platformModel = glider.platform
		? [glider.platform, glider.platformModel].filter(Boolean).join(" ")
		: null;

	return (
		<Box>
			<PageBreadcrumb
				catalogue="Glider fleet"
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
							md: "repeat(5, 1fr)",
						},
						gap: 3,
					}}
				>
					<Field label="Name" value={glider.name} />
					<Field label="Serial number" value={glider.serialNumber} />
					<Field label="WMO" value={glider.wmo} />
					<Field
						label="Purchase date"
						value={formatDate(glider.purchaseDate)}
					/>
					<Field label="Owner" value={glider.owner} />

					<Field
						label="Platform Model"
						value={
							<NvsValue
								text={
									<Box component="span" sx={{ textTransform: "capitalize" }}>
										{platformModel ?? "—"}
									</Box>
								}
								uri={glider.platformModelUri}
							/>
						}
					/>
					<Field
						label="Platform Type"
						value={
							<NvsValue
								text={glider.platformCategory ?? "—"}
								uri={glider.platformCategoryUri}
							/>
						}
					/>
					<Field
						label="Manufacturer"
						value={
							<NvsValue
								text={glider.platformManufacturerName ?? "—"}
								uri={glider.platformManufacturerUri}
							/>
						}
					/>
				</Box>
			</Paper>

			<Typography variant="h6" sx={{ mb: 1.5 }}>
				Current build
			</Typography>
			<Paper variant="outlined" sx={{ p: 3, mb: 2.5 }}>
				<GliderCurrentBuild components={build.components} />
			</Paper>

			<ComingSoonCard title="Status" />

			<Box sx={{ mt: 1.5 }}>
				<Accordion disableGutters>
					<AccordionSummary expandIcon={<ExpandMoreIcon />}>
						<Typography color="text.secondary">Science payload</Typography>
					</AccordionSummary>
					<AccordionDetails>
						<GliderSciencePayload sciencePayload={build.sciencePayload} />
					</AccordionDetails>
				</Accordion>

				<Accordion disableGutters>
					<AccordionSummary expandIcon={<ExpandMoreIcon />}>
						<Typography color="text.secondary">Servicing history</Typography>
					</AccordionSummary>
					<AccordionDetails>
						<GliderServicingHistory statusHistory={build.statusHistory} />
					</AccordionDetails>
				</Accordion>

				<Accordion disableGutters>
					<AccordionSummary expandIcon={<ExpandMoreIcon />}>
						<Typography color="text.secondary">Editing history</Typography>
					</AccordionSummary>
					<AccordionDetails>
						<GliderEditHistory editHistory={build.editHistory} />
					</AccordionDetails>
				</Accordion>
			</Box>
		</Box>
	);
}
