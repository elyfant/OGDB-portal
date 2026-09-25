"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { MissionMapEntry } from "@ogdb/types";
import dynamic from "next/dynamic";

// Leaflet touches `window` on import, so the map is client-only -- same
// reason MissionTrackMapLoader exists for the mission page's map.
const FleetMap = dynamic(() => import("./FleetMap"), {
	ssr: false,
	loading: () => <Box sx={{ height: "100%", backgroundColor: "#0d2745" }} />,
});

// Same local-dev escape hatch as MissionTrackMapLoader -- see the
// comment there.
const MAP_DISABLED = process.env.NEXT_PUBLIC_DISABLE_TRACK_MAP === "true";

export default function FleetMapLoader({
	missions,
}: {
	missions: MissionMapEntry[];
}) {
	if (MAP_DISABLED) {
		return (
			<Box
				sx={{
					height: "100%",
					backgroundColor: "#0d2745",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<Typography sx={{ color: "rgba(255,255,255,0.7)" }}>
					Map disabled (NEXT_PUBLIC_DISABLE_TRACK_MAP=true)
				</Typography>
			</Box>
		);
	}

	return <FleetMap missions={missions} />;
}
