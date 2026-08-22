import DatasetsTable from "@/components/DatasetsTable";
import { getDatasetProcessingStatuses } from "@/lib/api";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default async function DatasetsPage() {
	const datasets = await getDatasetProcessingStatuses();

	return (
		<Box>
			<Typography variant="h5" sx={{ mb: 2 }}>
				Datasets
			</Typography>
			<Typography variant="subtitle1" color="text.secondary">
				Every dataset associated with missions carried out by the fleet, click
				on a dataset to view its details and history.
			</Typography>
			<DatasetsTable datasets={datasets} />
		</Box>
	);
}
