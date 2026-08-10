import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import MissionsTable from "../../components/MissionsTable";
import { getMissions } from "../../lib/api";

export default async function MissionsPage() {
	const missions = await getMissions();

	return (
		<Box>
			<Typography variant="h5" sx={{ mb: 2 }}>
				Missions
			</Typography>
			<MissionsTable missions={missions} />
		</Box>
	);
}
