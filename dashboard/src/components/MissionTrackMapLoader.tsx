"use client";

import type { MissionTrackPoint } from "@ogdb/types";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import dynamic from "next/dynamic";

const MissionTrackMap = dynamic(() => import("./MissionTrackMap"), {
	ssr: false,
	loading: () => (
		<Box
			sx={{
				height: "100%",
				backgroundColor: "#0d2745",
			}}
		/>
	),
});

// Escape hatch for local dev: react-leaflet v4's MapContainer has a
// StrictMode double-invoke bug (see the fix attempt in
// MissionTrackMap.tsx) that, for at least one dev setup, crashes hard
// enough to take the whole app down rather than just erroring in
// isolation. Set NEXT_PUBLIC_DISABLE_TRACK_MAP=true when starting
// `next dev` to skip mounting Leaflet entirely and keep working on
// everything else. Production is unaffected either way -- StrictMode's
// double-invoke only runs under `next dev`.
const MAP_DISABLED = process.env.NEXT_PUBLIC_DISABLE_TRACK_MAP === "true";

type LatLon = { latitude: number; longitude: number };

export default function MissionTrackMapLoader({
	tracks,
	platform,
	deployment,
	recovery,
}: {
	tracks: MissionTrackPoint[];
	platform: "slocum" | "seaglider" | null;
	deployment: LatLon | null;
	recovery: LatLon | null;
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

	return (
		<MissionTrackMap
			tracks={tracks}
			platform={platform}
			deployment={deployment}
			recovery={recovery}
		/>
	);
}
