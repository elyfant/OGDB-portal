"use client";

import { formatDate } from "@/lib/format";
import {
	EMPTY_MISSION_MAP_FILTERS,
	type MissionMapFilters,
	filterMissionMapEntries,
	missionMapLabel,
	trackColor,
} from "@/lib/mission-map-filters";
import RouteIcon from "@mui/icons-material/Route";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Typography from "@mui/material/Typography";
import type { MissionMapEntry } from "@ogdb/types";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
	LayersControl,
	MapContainer,
	Polyline,
	Popup,
	ScaleControl,
	TileLayer,
} from "react-leaflet";
import FleetMapPanel from "./FleetMapPanel";
import {
	FIT_BOUNDS_OPTIONS,
	IMAGERY_ATTRIBUTION,
	IMAGERY_TILE_URL,
	OCEAN_ATTRIBUTION,
	OCEAN_TILE_URL,
	ResetViewControl,
} from "./MissionTrackMap";

// Where the map opens when no mission has a track yet -- roughly the
// Norwegian shelf, where the fleet works.
const FALLBACK_CENTER: [number, number] = [64, 6];
const FALLBACK_ZOOM = 5;

// With every mission on screen, one invisible hover marker per fix (the
// mission page's approach) would mean tens of thousands of DOM nodes.
// Instead every track is drawn on a single canvas, and the canvas
// renderer's `tolerance` widens each line's hover/click target by this
// many pixels either side so a 3px line is still easy to hit.
const HOVER_TOLERANCE_PX = 6;

type Hovered = { id: number; latlng: L.LatLng };

// The two corners of the box around every point in the given tracks --
// all fitBounds needs, and far smaller to hand around than every point.
function boundsOf(missions: MissionMapEntry[]): [number, number][] {
	let minLat = Number.POSITIVE_INFINITY;
	let minLon = Number.POSITIVE_INFINITY;
	let maxLat = Number.NEGATIVE_INFINITY;
	let maxLon = Number.NEGATIVE_INFINITY;
	for (const m of missions) {
		for (const [lat, lon] of m.track) {
			if (lat < minLat) minLat = lat;
			if (lat > maxLat) maxLat = lat;
			if (lon < minLon) minLon = lon;
			if (lon > maxLon) maxLon = lon;
		}
	}
	if (minLat === Number.POSITIVE_INFINITY) return [];
	return [
		[minLat, minLon],
		[maxLat, maxLon],
	];
}

export default function FleetMap({
	missions,
}: {
	missions: MissionMapEntry[];
}) {
	// Same react-leaflet v4 StrictMode workaround as MissionTrackMap --
	// see the comment there.
	const [mapKey, setMapKey] = useState(0);
	useEffect(() => {
		setMapKey((k) => k + 1);
	}, []);

	const renderer = useMemo(
		() => L.canvas({ tolerance: HOVER_TOLERANCE_PX }),
		[],
	);

	const [panelOpen, setPanelOpen] = useState(false);
	const [filters, setFilters] = useState<MissionMapFilters>(
		EMPTY_MISSION_MAP_FILTERS,
	);
	// Tracks the missions switched *off*, not on, so "every mission on"
	// is simply the empty starting state.
	const [hiddenIds, setHiddenIds] = useState<Set<number>>(() => new Set());
	const [hovered, setHovered] = useState<Hovered | null>(null);

	const filtered = useMemo(
		() => filterMissionMapEntries(missions, filters),
		[missions, filters],
	);
	const drawn = useMemo(
		() => filtered.filter((m) => m.track.length > 0 && !hiddenIds.has(m.id)),
		[filtered, hiddenIds],
	);

	// Initial view covers every track, whatever the filters later do --
	// computed from the full list so it's stable across re-renders.
	const initialBounds = useMemo(() => boundsOf(missions), [missions]);
	const drawnBounds = useMemo(() => boundsOf(drawn), [drawn]);

	const hoveredMission = hovered
		? drawn.find((m) => m.id === hovered.id)
		: undefined;

	return (
		<Box sx={{ position: "relative", height: "100%", width: "100%" }}>
			<MapContainer
				key={mapKey}
				{...(initialBounds.length > 0
					? { bounds: initialBounds, boundsOptions: FIT_BOUNDS_OPTIONS }
					: { center: FALLBACK_CENTER, zoom: FALLBACK_ZOOM })}
				renderer={renderer}
				style={{ height: "100%", width: "100%" }}
				scrollWheelZoom
			>
				<LayersControl position="topright">
					<LayersControl.BaseLayer checked name="Ocean">
						<TileLayer url={OCEAN_TILE_URL} attribution={OCEAN_ATTRIBUTION} />
					</LayersControl.BaseLayer>
					<LayersControl.BaseLayer name="Satellite">
						<TileLayer
							url={IMAGERY_TILE_URL}
							attribution={IMAGERY_ATTRIBUTION}
						/>
					</LayersControl.BaseLayer>
				</LayersControl>

				{drawn.map((m) => (
					<Polyline
						key={m.id}
						positions={m.track}
						pathOptions={{
							color: trackColor(m.id),
							weight: hovered?.id === m.id ? 5 : 3,
							opacity: 0.9,
						}}
						eventHandlers={{
							mouseover: (e) => setHovered({ id: m.id, latlng: e.latlng }),
						}}
					/>
				))}

				{/* A Popup rather than a Tooltip: a Leaflet tooltip closes the
				    moment the mouse leaves the line, so its link could never
				    be clicked. This opens on hover and stays until the user
				    hovers another track or clicks elsewhere on the map. */}
				{hovered && hoveredMission && (
					<Popup
						position={hovered.latlng}
						autoPan={false}
						closeButton={false}
						eventHandlers={{
							remove: () =>
								setHovered((h) => (h?.id === hoveredMission.id ? null : h)),
						}}
					>
						<Box sx={{ minWidth: 180 }}>
							<Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
								{missionMapLabel(hoveredMission)}
							</Typography>
							<Typography sx={{ fontSize: "0.8rem" }}>
								{hoveredMission.glider ?? "Unknown glider"}
								{hoveredMission.site ? ` · ${hoveredMission.site}` : ""}
							</Typography>
							<Typography sx={{ fontSize: "0.8rem", mb: 0.5 }}>
								{formatDate(hoveredMission.launchDate)} –{" "}
								{hoveredMission.recoveryDate
									? formatDate(hoveredMission.recoveryDate)
									: "ongoing"}
							</Typography>
							<MuiLink
								component={Link}
								href={`/missions/${hoveredMission.id}`}
								sx={{ fontSize: "0.8rem" }}
							>
								Mission details →
							</MuiLink>
						</Box>
					</Popup>
				)}

				<ScaleControl position="bottomleft" imperial={false} />
				<ResetViewControl
					bounds={drawnBounds.length > 0 ? drawnBounds : initialBounds}
				/>
			</MapContainer>

			{/* Sits in Leaflet's own top-right control column, just under the
			    layers button (10px margin + 44px button + 10px gap), styled
			    to match it. Lives outside MapContainer so clicks and scrolls
			    inside the panel never reach the map. */}
			{panelOpen ? (
				<FleetMapPanel
					missions={missions}
					filtered={filtered}
					filters={filters}
					onFiltersChange={setFilters}
					hiddenIds={hiddenIds}
					onHiddenIdsChange={setHiddenIds}
					onClose={() => setPanelOpen(false)}
				/>
			) : (
				<Box
					component="button"
					type="button"
					title="Missions"
					aria-label="Show missions panel"
					onClick={() => setPanelOpen(true)}
					sx={{
						position: "absolute",
						top: 64,
						right: 10,
						zIndex: 1000,
						width: 44,
						height: 44,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						backgroundColor: "#fff",
						color: "#333",
						border: "2px solid rgba(0,0,0,0.2)",
						borderRadius: "5px",
						backgroundClip: "padding-box",
						cursor: "pointer",
						"&:hover": { backgroundColor: "#f4f4f4" },
					}}
				>
					<RouteIcon />
				</Box>
			)}
		</Box>
	);
}
