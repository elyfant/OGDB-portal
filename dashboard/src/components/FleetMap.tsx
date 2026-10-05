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
	Pane,
	Polyline,
	Popup,
	ScaleControl,
	TileLayer,
} from "react-leaflet";
import FleetMapPanel from "./FleetMapPanel";
import {
	IMAGERY_ATTRIBUTION,
	IMAGERY_TILE_URL,
	OCEAN_ATTRIBUTION,
	OCEAN_TILE_URL,
	ResetViewControl,
} from "./MissionTrackMap";

// The map opens framed on this latitude band -- the fleet's working area
// from the southern Norwegian shelf up past Svalbard -- rather than on
// whatever box the tracks happen to make. Longitude still follows the
// tracks (falling back to FALLBACK_WEST/EAST when none have one yet),
// so the band is centred on where the gliders have actually been.
const INITIAL_SOUTH = 58.0;
const INITIAL_NORTH = 82.5;
const FALLBACK_WEST = -30;
const FALLBACK_EAST = 30;
// No padding on the opening fit, so the band's edges land at the
// window's edges rather than 24px inside them.
const INITIAL_FIT_OPTIONS: L.FitBoundsOptions = { padding: [0, 0] };

// With every mission on screen, one invisible hover marker per fix (the
// mission page's approach) would mean tens of thousands of DOM nodes.
// Instead every track is drawn on a single canvas, and the canvas
// renderer's `tolerance` widens each line's hover/click target by this
// many pixels either side so a 3px line is still easy to hit.
const HOVER_TOLERANCE_PX = 6;

// The track palette is pastel, which nearly vanishes on the pale Ocean
// basemap, so every track gets a dark outline drawn underneath it: the
// coloured line plus this many px either side. The outlines live in their
// own pane, stacked just below Leaflet's overlayPane (z-index 400) where
// the coloured lines are, so every outline sits under every colour --
// a mission switched back on later can't have its outline drawn over
// its neighbours' colours.
const OUTLINE_COLOR = "#1f2a33";
const OUTLINE_EXTRA_PX = 2;
const OUTLINE_PANE = "trackOutlines";
const TRACK_WEIGHT = 3;
const HIGHLIGHT_WEIGHT = 5;

// `seq` counts clicks, so each click remounts the Popup fresh (it's the
// Popup's key) and a stale Popup's "remove" event can't clear a newer
// selection -- even a second click on the same track.
type Selected = { id: number; latlng: L.LatLng; seq: number };

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
	const [hoveredId, setHoveredId] = useState<number | null>(null);
	const [selected, setSelected] = useState<Selected | null>(null);

	const filtered = useMemo(
		() => filterMissionMapEntries(missions, filters),
		[missions, filters],
	);
	const drawn = useMemo(
		() => filtered.filter((m) => m.track.length > 0 && !hiddenIds.has(m.id)),
		[filtered, hiddenIds],
	);

	// Bounds of every track, whatever the filters later do -- computed
	// from the full list so it's stable across re-renders. Used for the
	// opening view's longitude and as the reset button's fallback.
	const allBounds = useMemo(() => boundsOf(missions), [missions]);
	const drawnBounds = useMemo(() => boundsOf(drawn), [drawn]);
	const initialBounds = useMemo<[number, number][]>(
		() => [
			[INITIAL_SOUTH, allBounds[0]?.[1] ?? FALLBACK_WEST],
			[INITIAL_NORTH, allBounds[1]?.[1] ?? FALLBACK_EAST],
		],
		[allBounds],
	);

	const selectedMission = selected
		? drawn.find((m) => m.id === selected.id)
		: undefined;

	return (
		<Box sx={{ position: "relative", height: "100%", width: "100%" }}>
			<MapContainer
				key={mapKey}
				bounds={initialBounds}
				boundsOptions={INITIAL_FIT_OPTIONS}
				renderer={renderer}
				// Lets the outline pane's own renderer (which Leaflet creates
				// per pane) be a canvas too, instead of falling back to SVG.
				preferCanvas
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

				<Pane name={OUTLINE_PANE} style={{ zIndex: 399 }}>
					{drawn.map((m) => {
						const highlighted = hoveredId === m.id || selected?.id === m.id;
						return (
							<Polyline
								key={m.id}
								positions={m.track}
								interactive={false}
								pathOptions={{
									color: OUTLINE_COLOR,
									weight:
										(highlighted ? HIGHLIGHT_WEIGHT : TRACK_WEIGHT) +
										2 * OUTLINE_EXTRA_PX,
									opacity: 0.7,
								}}
							/>
						);
					})}
				</Pane>

				{drawn.map((m) => (
					<Polyline
						key={m.id}
						positions={m.track}
						pathOptions={{
							color: trackColor(m.id),
							weight:
								hoveredId === m.id || selected?.id === m.id
									? HIGHLIGHT_WEIGHT
									: TRACK_WEIGHT,
							// Fully opaque: at 0.85 the dark outline beneath
							// would muddy the pastels.
							opacity: 1,
						}}
						eventHandlers={{
							// Hover only highlights -- raised to the top so a
							// thickened line isn't half-hidden under its
							// neighbours. The popup waits for a click.
							mouseover: (e) => {
								e.target.bringToFront();
								setHoveredId(m.id);
							},
							mouseout: () => setHoveredId((h) => (h === m.id ? null : h)),
							click: (e) =>
								setSelected((s) => ({
									id: m.id,
									latlng: e.latlng,
									seq: (s?.seq ?? 0) + 1,
								})),
						}}
					/>
				))}

				{/* Opens on click, not hover -- a hover popup kept popping up
				    while just panning across busy areas. Stays until the
				    user clicks another track or anywhere else on the map
				    (Leaflet's closeOnClick), so its link can be clicked. */}
				{selected && selectedMission && (
					<Popup
						key={selected.seq}
						position={selected.latlng}
						autoPan={false}
						closeButton={false}
						eventHandlers={{
							remove: () =>
								setSelected((s) => (s?.seq === selected.seq ? null : s)),
						}}
					>
						<Box sx={{ minWidth: 180 }}>
							<Typography sx={{ fontWeight: 700, fontSize: "0.85rem" }}>
								{missionMapLabel(selectedMission)}
							</Typography>
							<Typography sx={{ fontSize: "0.8rem" }}>
								{selectedMission.glider ?? "Unknown glider"}
								{selectedMission.site ? ` · ${selectedMission.site}` : ""}
							</Typography>
							<Typography sx={{ fontSize: "0.8rem", mb: 0.5 }}>
								{formatDate(selectedMission.launchDate)} –{" "}
								{selectedMission.recoveryDate
									? formatDate(selectedMission.recoveryDate)
									: "ongoing"}
							</Typography>
							<MuiLink
								component={Link}
								href={`/missions/${selectedMission.id}`}
								sx={{ fontSize: "0.8rem" }}
							>
								Mission details →
							</MuiLink>
						</Box>
					</Popup>
				)}

				<ScaleControl position="bottomleft" imperial={false} />
				<ResetViewControl
					bounds={drawnBounds.length > 0 ? drawnBounds : allBounds}
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
