import LocationsManager from "@/components/LocationsManager";
import { getLocations } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default async function LocationsPage() {
	const [locations, user] = await Promise.all([
		getLocations(true),
		getCurrentUser(),
	]);
	const canEdit = user?.role === "editor" || user?.role === "admin";

	return (
		<Box>
			<Typography variant="h5" sx={{ mb: 2 }}>
				Locations
			</Typography>
			<Typography
				variant="subtitle1"
				color="text.secondary"
				sx={{ mb: 3, maxWidth: 720 }}
			>
				The places a glider or other asset can be recorded at. One list, shared
				by everyone: a location is a fact about the asset, so it has to mean the
				same thing to every user. Add a place if yours is missing. Places are
				deactivated rather than deleted, so history stays readable.
			</Typography>
			<LocationsManager locations={locations} canEdit={canEdit} />
		</Box>
	);
}
