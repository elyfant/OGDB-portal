"use client";

import type { MissionTrackPoint } from "@ogdb/types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatDate, formatDateTime } from "@/lib/format";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useEffect, useMemo, useState } from "react";
import {
	CircleMarker,
	LayerGroup,
	LayersControl,
	MapContainer,
	Marker,
	Polyline,
	ScaleControl,
	TileLayer,
	Tooltip,
	useMap,
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

// `tracks` itself is already a subsample of the glider's real surfacings
// (roughly every nth dive, not every one), and no true dive_number is
// stored alongside a fix -- so the popup labels each fix by its position
// in this returned sequence ("Surfacing #n") rather than claiming it's
// the glider's actual onboard dive count.
const FIT_BOUNDS_OPTIONS: L.FitBoundsOptions = { padding: [24, 24] };

const TOOLTIP_BOX_SX = {
	backgroundColor: "#0d2745",
	color: "#fff",
	fontSize: "0.8rem",
	lineHeight: 1.5,
	minWidth: 160,
};

type LatLon = { latitude: number; longitude: number };

function formatCoord(lat: number, lon: number): string {
	const latDir = lat >= 0 ? "N" : "S";
	const lonDir = lon >= 0 ? "E" : "W";
	return `${Math.abs(lat).toFixed(3)}°${latDir}, ${Math.abs(lon).toFixed(3)}°${lonDir}`;
}

function formatMeasurement(value: number | null, unit: string): string {
	return value === null ? "—" : `${value.toFixed(2)} ${unit}`;
}

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

// No built-in react-leaflet control resets the view, so this wraps a
// vanilla Leaflet control (the same pattern Leaflet itself uses for
// zoom/scale) in a component that adds/removes it via useMap(). Sits in
// the same corner as the default zoom control and stacks below it.
function ResetViewControl({
	bounds,
}: {
	bounds: [number, number][];
}) {
	const map = useMap();

	useEffect(() => {
		if (bounds.length === 0) return;

		const control = new L.Control({ position: "topleft" });
		control.onAdd = () => {
			const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
			const button = L.DomUtil.create("a", "", container);
			button.href = "#";
			button.title = "Reset view";
			button.setAttribute("aria-label", "Reset view");
			button.style.display = "flex";
			button.style.alignItems = "center";
			button.style.justifyContent = "center";
			button.innerHTML =
				'<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';

			L.DomEvent.on(button, "click", (e) => {
				L.DomEvent.stop(e);
				map.fitBounds(bounds, FIT_BOUNDS_OPTIONS);
			});
			L.DomEvent.disableClickPropagation(container);

			return container;
		};

		control.addTo(map);
		return () => {
			control.remove();
		};
	}, [map, bounds]);

	return null;
}

export default function MissionTrackMap({
	tracks,
	platform,
	deployment,
	deploymentDate,
	recovery,
	recoveryDate,
}: {
	tracks: MissionTrackPoint[];
	platform: "slocum" | "seaglider" | null;
	deployment: LatLon | null;
	deploymentDate: string | null;
	recovery: LatLon | null;
	recoveryDate: string | null;
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

	const linePositions = useMemo<[number, number][]>(
		() => tracks.map((t) => [t.latitude, t.longitude]),
		[tracks],
	);
	const waypoints = useMemo(
		() => tracks.filter((_, i) => i % WAYPOINT_STRIDE === 0),
		[tracks],
	);

	const boundsPoints = useMemo<[number, number][]>(
		() => [
			...linePositions,
			...(deployment
				? ([[deployment.latitude, deployment.longitude]] as [number, number][])
				: []),
			...(recovery
				? ([[recovery.latitude, recovery.longitude]] as [number, number][])
				: []),
		],
		[linePositions, deployment, recovery],
	);

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
			boundsOptions={FIT_BOUNDS_OPTIONS}
			style={{ height: "100%", width: "100%" }}
			scrollWheelZoom
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
						{/* Visual crumbs only -- non-interactive so they don't shadow
						    the full-resolution hover targets below them. */}
						{waypoints.map((p) => (
							<CircleMarker
								key={p.utc}
								center={[p.latitude, p.longitude]}
								radius={3.5}
								interactive={false}
								pathOptions={{
									color: "#7a1810",
									weight: 0.75,
									fillColor: "#f2887e",
									fillOpacity: 1,
								}}
							/>
						))}
						{/* Invisible hover targets over every fix in the returned
						    track (not just the sparser visual crumbs above), so
						    hovering anywhere along the drawn track surfaces that
						    fix's data. */}
						{tracks.map((p, i) => (
							<CircleMarker
								key={`hover-${p.utc}`}
								center={[p.latitude, p.longitude]}
								radius={8}
								pathOptions={{ opacity: 0, fillOpacity: 0 }}
							>
								<Tooltip direction="top" offset={[0, -4]} sticky>
									<Box sx={TOOLTIP_BOX_SX}>
										<Typography sx={{ fontWeight: 700, fontSize: "0.8rem" }}>
											Surfacing #{i + 1}
										</Typography>
										<Typography sx={{ fontSize: "0.8rem" }}>
											{formatDateTime(p.utc)}
										</Typography>
										<Typography sx={{ fontSize: "0.8rem" }}>
											{formatCoord(p.latitude, p.longitude)}
										</Typography>
										<Typography sx={{ fontSize: "0.8rem" }}>
											Temp: {formatMeasurement(p.temperature, "°C")}
										</Typography>
										<Typography sx={{ fontSize: "0.8rem" }}>
											Sal: {formatMeasurement(p.salinity, "PSU")}
										</Typography>
									</Box>
								</Tooltip>
							</CircleMarker>
						))}
						{deployment && (
							<Marker
								position={[deployment.latitude, deployment.longitude]}
								icon={buildGliderIcon(platform, "#3fae4a")}
							>
								<Tooltip direction="top" offset={[0, -15]}>
									<Box sx={TOOLTIP_BOX_SX}>
										<Typography sx={{ fontWeight: 700, fontSize: "0.8rem" }}>
											Start of mission
										</Typography>
										<Typography sx={{ fontSize: "0.8rem" }}>
											{formatDate(deploymentDate)}
										</Typography>
										<Typography sx={{ fontSize: "0.8rem" }}>
											{formatCoord(deployment.latitude, deployment.longitude)}
										</Typography>
									</Box>
								</Tooltip>
							</Marker>
						)}
						{recovery && (
							<Marker
								position={[recovery.latitude, recovery.longitude]}
								icon={buildGliderIcon(platform, "#e5473b")}
							>
								<Tooltip direction="top" offset={[0, -15]}>
									<Box sx={TOOLTIP_BOX_SX}>
										<Typography sx={{ fontWeight: 700, fontSize: "0.8rem" }}>
											End of mission
										</Typography>
										<Typography sx={{ fontSize: "0.8rem" }}>
											{formatDate(recoveryDate)}
										</Typography>
										<Typography sx={{ fontSize: "0.8rem" }}>
											{formatCoord(recovery.latitude, recovery.longitude)}
										</Typography>
									</Box>
								</Tooltip>
							</Marker>
						)}
					</LayerGroup>
				</LayersControl.Overlay>
			</LayersControl>
			<ScaleControl position="bottomleft" imperial={false} />
			<ResetViewControl bounds={boundsPoints} />
		</MapContainer>
	);
}
