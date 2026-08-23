"use client";

import type { MissionTrackPoint } from "@ogdb/types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";
import {
	CircleMarker,
	LayerGroup,
	LayersControl,
	MapContainer,
	Marker,
	Polyline,
	ScaleControl,
	TileLayer,
} from "react-leaflet";

const OCEAN_TILE_URL =
	"https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}";
const OCEAN_ATTRIBUTION =
	"Esri, GEBCO, NOAA, National Geographic, DeLorme, HERE, Geonames.org, and other contributors";

const IMAGERY_TILE_URL =
	"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const IMAGERY_ATTRIBUTION = "Esri, Maxar, Earthstar Geographics";

// Every 5th fix gets a small waypoint dot -- the full-resolution line is
// cheap to draw (a mission tops out around a few thousand points), the
// sparse dots are just so the track doesn't read as a single unbroken
// ribbon with no sense of point density.
const WAYPOINT_STRIDE = 5;

type LatLon = { latitude: number; longitude: number };

// Slocum: elongated torpedo silhouette with two small fins, matching the
// physical shape of the hull. Seaglider: a rounder, finless dive-shaped
// glyph -- the two platforms look different in the water, so the markers
// should too. Anything else (platform not recorded) falls back to a
// plain pin so a marker still renders.
function gliderIconSvg(platform: "slocum" | "seaglider" | null): string {
	if (platform === "seaglider") {
		return `<path d="M12 2C8.5 2 6 7 6 12s2.5 10 6 10 6-5 6-10S15.5 2 12 2z"/>`;
	}
	if (platform === "slocum") {
		return `<path d="M12 1L15.5 9V15L12 23L8.5 15V9Z"/><path d="M2 11L8.5 10V13Z"/><path d="M22 11L15.5 10V13Z"/>`;
	}
	return `<path d="M12 2C7 2 4 6 4 10c0 6 8 12 8 12s8-6 8-12c0-4-3-8-8-8z"/>`;
}

function buildGliderIcon(
	platform: "slocum" | "seaglider" | null,
	color: string,
) {
	return L.divIcon({
		className: "",
		html: `<div style="width:30px;height:30px;border-radius:50%;background:#0d2745;border:2px solid ${color};display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.5);">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="${color}">${gliderIconSvg(platform)}</svg>
    </div>`,
		iconSize: [30, 30],
		iconAnchor: [15, 15],
		popupAnchor: [0, -15],
	});
}

export default function MissionTrackMap({
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
	// react-leaflet v4's MapContainer creates its Leaflet map from a
	// useCallback ref with an empty dependency array -- that callback's
	// closure permanently sees context===null from its first invocation,
	// so if the ref ever fires a second time on the same DOM node (which
	// is exactly what React 18 StrictMode's dev-mode double-invoke does
	// to callback refs), it tries to init a second Leaflet map on a
	// container that's already initialized and throws. Bumping this key
	// once after mount forces a real unmount+remount via React's
	// key-based reconciliation instead of a ref recycle, so MapContainer
	// only ever sees one ref-callback cycle per instance -- the
	// react-leaflet-recommended workaround until v5 (React 19) fixes
	// this internally. Costs one harmless extra create/teardown cycle
	// on first mount.
	const [mapKey, setMapKey] = useState(0);
	useEffect(() => {
		setMapKey((k) => k + 1);
	}, []);

	const linePositions: [number, number][] = tracks.map((t) => [
		t.latitude,
		t.longitude,
	]);
	const waypoints = tracks.filter((_, i) => i % WAYPOINT_STRIDE === 0);

	const boundsPoints: [number, number][] = [
		...linePositions,
		...(deployment ? [[deployment.latitude, deployment.longitude]] : []),
		...(recovery ? [[recovery.latitude, recovery.longitude]] : []),
	] as [number, number][];

	if (boundsPoints.length === 0) {
		return (
			<Box
				sx={{
					height: "100%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "#0d2745",
				}}
			>
				<Typography sx={{ color: "rgba(255,255,255,0.7)" }}>
					No track data available for this mission yet.
				</Typography>
			</Box>
		);
	}

	return (
		<MapContainer
			key={mapKey}
			bounds={boundsPoints}
			boundsOptions={{ padding: [24, 24] }}
			style={{ height: "100%", width: "100%" }}
			scrollWheelZoom={false}
		>
			<LayersControl position="topright">
				<LayersControl.BaseLayer checked name="Ocean">
					<TileLayer url={OCEAN_TILE_URL} attribution={OCEAN_ATTRIBUTION} />
				</LayersControl.BaseLayer>
				<LayersControl.BaseLayer name="Satellite">
					<TileLayer url={IMAGERY_TILE_URL} attribution={IMAGERY_ATTRIBUTION} />
				</LayersControl.BaseLayer>
				<LayersControl.Overlay checked name="Track">
					<LayerGroup>
						<Polyline
							positions={linePositions}
							pathOptions={{ color: "#e5473b", weight: 3, opacity: 0.85 }}
						/>
						{waypoints.map((p) => (
							<CircleMarker
								key={p.utc}
								center={[p.latitude, p.longitude]}
								radius={3.5}
								pathOptions={{
									color: "#7a1810",
									weight: 0.75,
									fillColor: "#f2887e",
									fillOpacity: 1,
								}}
							/>
						))}
						{deployment && (
							<Marker
								position={[deployment.latitude, deployment.longitude]}
								icon={buildGliderIcon(platform, "#3fae4a")}
							/>
						)}
						{recovery && (
							<Marker
								position={[recovery.latitude, recovery.longitude]}
								icon={buildGliderIcon(platform, "#e5473b")}
							/>
						)}
					</LayerGroup>
				</LayersControl.Overlay>
			</LayersControl>
			<ScaleControl position="bottomleft" imperial={false} />
		</MapContainer>
	);
}
