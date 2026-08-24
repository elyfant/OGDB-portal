import PageBreadcrumb from "@/components/PageBreadcrumb";
import QcPipelineDiagram from "@/components/QcPipelineDiagram";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

const GLOSSARY: { term: string; definition: string }[] = [
	{
		term: "RT",
		definition: "Real-time — data as it arrives from the vehicle, unreviewed.",
	},
	{
		term: "DM",
		definition:
			"Delayed mode — reprocessing once the full dataset is back, with automated QC applied.",
	},
	{
		term: "L1 / L2",
		definition:
			"Timeseries / gridded data products. Both are produced together at each processing-maturity step (Delayed Mode Dataset, then Published Dataset) — they're not separate pipeline stages.",
	},
	{
		term: "Manual QC",
		definition:
			"A person flags bad data and, for Seaglider, checks it against shipboard CTD casts. Marked on each pipeline as a phase 1 / phase 2 checkpoint.",
	},
	{
		term: "Final QC",
		definition:
			"The last review pass on the delayed-mode data product before it is published.",
	},
];

function TbcSection({ title }: { title: string }) {
	return (
		<Paper variant="outlined" sx={{ p: 3 }}>
			<Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
				{title}
			</Typography>
			<Typography variant="body2" color="text.disabled" fontStyle="italic">
				To be confirmed — a written description of what this stage covers
				hasn't been drafted yet.
			</Typography>
		</Paper>
	);
}

export default function QcPipelinePage() {
	return (
		<Box>
			<PageBreadcrumb
				catalogue="Datasets"
				catalogueHref="/datasets"
				current="NorGliders QC processing pipeline"
			/>

			<Typography variant="h5" sx={{ mb: 1 }}>
				NorGliders QC processing pipeline
			</Typography>
			<Typography
				variant="body1"
				color="text.secondary"
				sx={{ mb: 3, maxWidth: "72ch" }}
			>
				Both platforms move from raw real-time telemetry through delayed mode
				processing to a published data product, but they lean on manual QC
				differently: <strong>Seaglider</strong> runs a manual check twice —
				phase 1, feeding into delayed mode processing itself, where bad data
				is flagged and compared against shipboard CTD casts, and phase 2, just
				before the final pass — while <strong>Slocum</strong> runs a single
				manual check, covering phase 1 and phase 2 together, only at the final
				pass.
			</Typography>

			<Box sx={{ mb: 1.5 }}>
				<QcPipelineDiagram />
			</Box>
			<Typography
				variant="caption"
				color="text.secondary"
				sx={{ display: "block", mb: 4, maxWidth: "72ch" }}
			>
				Reproduced from a whiteboard sketch comparing the two glider QC
				workflows. Solid arrows are automated data movement; dashed arrows
				are the points where a person reviews or corrects the record before
				it moves on.
			</Typography>

			<Typography variant="h6" sx={{ mb: 1.5 }}>
				Delayed Mode Dataset / Published Dataset stages
			</Typography>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
					gap: 2,
					mb: 4,
				}}
			>
				<TbcSection title="Delayed Mode Dataset" />
				<TbcSection title="Published Dataset" />
			</Box>

			<Typography variant="h6" sx={{ mb: 1.5 }}>
				Abbreviations
			</Typography>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: {
						xs: "1fr",
						sm: "repeat(2, 1fr)",
						md: "repeat(3, 1fr)",
					},
					gap: 3,
				}}
			>
				{GLOSSARY.map((g) => (
					<Box key={g.term}>
						<Typography
							variant="body2"
							fontFamily="monospace"
							fontWeight={700}
							color="primary.main"
						>
							{g.term}
						</Typography>
						<Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
							{g.definition}
						</Typography>
					</Box>
				))}
			</Box>
		</Box>
	);
}
