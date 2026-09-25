import FleetMapLoader from "@/components/FleetMapLoader";
import { getMissionMapEntries } from "@/lib/api";
import Box from "@mui/material/Box";

export default async function MapPage() {
	const missions = await getMissionMapEntries();

	// Negative margins cancel AppShell's main padding (same trick the
	// mission page's header map uses) so the map runs edge to edge, and
	// the height is the viewport minus the AppBar -- MUI's Toolbar is
	// 56px below the sm breakpoint, 64px above it.
	return (
		<Box
			sx={{
				m: -3,
				height: { xs: "calc(100vh - 56px)", sm: "calc(100vh - 64px)" },
			}}
		>
			<FleetMapLoader missions={missions} />
		</Box>
	);
}
