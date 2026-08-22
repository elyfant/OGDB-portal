import CruisesTable from "@/components/CruisesTable";
import { getCruises } from "@/lib/api";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default async function CruisesPage() {
	const cruises = await getCruises();

	return (
		<Box>
			<Typography variant="h5" sx={{ mb: 2 }}>
				Cruises
			</Typography>
			<Typography variant="subtitle1" color="text.secondary">
				Every research cruise associated with the fleet, click on a cruise to
				view its details and history.
			</Typography>
			<CruisesTable cruises={cruises} />
		</Box>
	);
}
