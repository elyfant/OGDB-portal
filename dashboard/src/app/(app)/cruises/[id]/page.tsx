import Field from "@/components/Field";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { getCruise } from "@/lib/api";
import { formatDate } from "@/lib/format";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

export default async function CruiseDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const cruise = await getCruise(Number(id));
	if (!cruise) notFound();

	return (
		<Box>
			<PageBreadcrumb
				catalogue="Cruises"
				catalogueHref="/cruises"
				current={cruise.cruiseName}
			/>

			<Typography variant="h5" sx={{ mb: 3 }}>
				Cruise: {cruise.cruiseName}
			</Typography>

			<Typography variant="h6" sx={{ mb: 1.5 }}>
				About cruise
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
					<Field label="Cruise number" value={cruise.cruiseNumber} />
					<Field
						label="Vessel"
						value={
							cruise.vessel && cruise.vesselUrl ? (
								<MuiLink href={cruise.vesselUrl} target="_blank" rel="noreferrer">
									{cruise.vessel}{" "}
									<OpenInNewIcon sx={{ fontSize: 13, verticalAlign: -1 }} />
								</MuiLink>
							) : (
								cruise.vessel
							)
						}
					/>
					<Field label="Institute" value={cruise.institute} />
					<Field label="Cruise leader" value={cruise.cruiseLeader} />
					<Field label="Area" value={cruise.area} />
				</Box>
			</Paper>

			<Typography variant="h6" sx={{ mb: 1.5 }}>
				Itinerary
			</Typography>
			<Paper variant="outlined" sx={{ p: 3 }}>
				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
						gap: 3,
					}}
				>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
						<Typography
							variant="overline"
							color="text.secondary"
							sx={{ letterSpacing: 1 }}
						>
							Departure
						</Typography>
						<Field label="Date" value={formatDate(cruise.startDate)} />
						<Field label="Port" value={cruise.startPort} />
					</Box>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
						<Typography
							variant="overline"
							color="text.secondary"
							sx={{ letterSpacing: 1 }}
						>
							Arrival
						</Typography>
						<Field label="Date" value={formatDate(cruise.endDate)} />
						<Field label="Port" value={cruise.endPort} />
					</Box>
				</Box>
			</Paper>
		</Box>
	);
}
