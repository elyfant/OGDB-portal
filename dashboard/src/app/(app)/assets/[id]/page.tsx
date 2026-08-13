import DetailFields from "@/components/DetailFields";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { getAsset } from "@/lib/api";
import { formatDate, formatUsd } from "@/lib/format";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { notFound, redirect } from "next/navigation";

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

	return (
		<Box>
			<PageBreadcrumb
				catalogue="Assets"
				catalogueHref="/assets"
				current={asset.name ?? asset.serialNumber ?? `Asset ${asset.id}`}
			/>
			<Typography variant="h5" sx={{ mb: 2 }}>
				Assets : {asset.name ?? asset.serialNumber ?? `Asset ${asset.id}`}
			</Typography>
			<DetailFields
				fields={[
					{ label: "Serial number", value: asset.serialNumber },
					{
						label: "Asset type",
						value: asset.assetType.replaceAll("_", " "),
					},
					{ label: "Asset type group", value: asset.assetTypeGroup },
					{ label: "Asset model", value: asset.assetModel },
					{ label: "Platform model", value: asset.platformModelFull },
					{ label: "Platform category", value: asset.platformCategory },
					{ label: "Purchase date", value: formatDate(asset.purchaseDate) },
					{
						label: "Purchase value",
						value: formatUsd(asset.purchaseValueUsd),
					},
					{ label: "Status", value: asset.status },
				]}
			/>
		</Box>
	);
}
