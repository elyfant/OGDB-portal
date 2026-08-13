import DetailFields from "@/components/DetailFields";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { getGlider } from "@/lib/api";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

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
			<Typography variant="h5" sx={{ mb: 2 }}>
				Fleet : {glider.name}
			</Typography>
			<DetailFields
				fields={[
					{ label: "WMO", value: glider.wmo },
					{ label: "Platform", value: glider.platform },
					{ label: "Platform model", value: glider.platformModelFull },
					{ label: "Platform category", value: glider.platformCategory },
					{ label: "Serial number", value: glider.serialNumber },
					{ label: "Status", value: glider.status },
				]}
			/>
		</Box>
	);
}
