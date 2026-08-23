"use client";

import type { MissionTrackPoint } from "@ogdb/types";
import Box from "@mui/material/Box";
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
	return (
		<MissionTrackMap
			tracks={tracks}
			platform={platform}
			deployment={deployment}
			recovery={recovery}
		/>
	);
}
