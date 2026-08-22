import CruiseFormDialog from "@/components/CruiseFormDialog";
import CruisesTable from "@/components/CruisesTable";
import { getCruises, getInstitutes, getVessels } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default async function CruisesPage() {
	const [cruises, vessels, institutes, user] = await Promise.all([
		getCruises(),
		getVessels(),
		getInstitutes(),
		getCurrentUser(),
	]);
	const canEdit = user?.role === "editor" || user?.role === "admin";

	return (
		<Box>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					mb: 2,
				}}
			>
				<Typography variant="h5">Cruises</Typography>
				{canEdit && (
					<CruiseFormDialog vessels={vessels} institutes={institutes} />
				)}
			</Box>
			<Typography variant="subtitle1" color="text.secondary">
				Every research cruise associated with the fleet, click on a cruise to
				view its details and history.
			</Typography>
			<CruisesTable cruises={cruises} />
		</Box>
	);
}
