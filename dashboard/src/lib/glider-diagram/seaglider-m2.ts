import type { GliderBuildComponent } from "@ogdb/types";
import {
	type AttachedSlot,
	type DiagramLayout,
	type DiagramSpec,
	type InlineSlot,
	type Placement,
	layoutDiagram,
} from "./layout";
import { PARTS } from "./seaglider-m2/parts.generated";

// Slot rules for a Seaglider (M1/M2) diagram. Unlike a Slocum, whose body is
// assembled from parts in the build, a Seaglider's body IS the glider: it is
// always drawn, never an asset, and everything else sits on it. The artwork
// is in seaglider-m2/*.svg (embedded by scripts/build_glider_parts.py).
//
// Coordinates below are deck units measured from the body's top-left corner.
// The body's top edge runs about y=5..40 and its underside y=100..137 across
// the nose and hatch region (x=100..280); the hull axis is y=70.

const isLegato = (c: GliderBuildComponent) => /legato/i.test(c.model ?? "");

// A part of size w x h whose centre is at (cx, cy).
const centred = (
	w: number,
	h: number,
	cx: number,
	cy: number,
	ghost = false,
	extra: Partial<Placement> = {},
): Placement => ({ dx: cx - w / 2, dy: cy - h / 2, ghost, ...extra });

// Every hatch-region sensor (RBR legato, ECO puck, DO) mounts at the same
// place along the hull: one shared centre x, and the hull skin there. Upper
// hatch is the top skin, lower hatch the underside; a part lies flat on the
// skin, tilted to its slope (degrees, clockwise; the top rises towards the
// nose, the underside falls towards it). Measured from the body outline.
const SITE = {
	cx: 175,
	topY: 22.4,
	topTilt: -11.6,
	bottomY: 118.1,
	bottomTilt: 10.2,
};

// Centre of a w x h part lying on the skin at SITE.cx: half its height away
// from the skin, measured straight up/down (the skin is sloped, so that is a
// little more than h/2).
const rise = (h: number, tiltDeg: number) =>
	h / 2 / Math.cos((tiltDeg * Math.PI) / 180);

// Where a hatch-region sensor goes for each location the user can choose
// (the same values the build editor offers -- see OPTIONAL_POSITIONS in
// asset-positions.ts). Upper/lower hatch sit on the hull top and underside;
// starboard, centre and port are the flank. With the nose pointing left the
// port side faces the viewer; starboard is the far side, so it is drawn faded.
function sensorPlacements(
	w: number,
	h: number,
): { fallback: Placement; placements: Record<string, Placement> } {
	const upperHatch = centred(
		w,
		h,
		SITE.cx,
		SITE.topY - rise(h, SITE.topTilt),
		false,
		{ rotate: SITE.topTilt },
	);
	return {
		// No position recorded: the upper hatch, as in the reference sketch.
		fallback: upperHatch,
		placements: {
			"upper hatch": upperHatch,
			// Underside: turned over, so the part's face looks down.
			"lower hatch": centred(
				w,
				h,
				SITE.cx,
				SITE.bottomY + rise(h, SITE.bottomTilt),
				false,
				{ rotate: SITE.bottomTilt, flip: true },
			),
			port: centred(w, h, SITE.cx, 92),
			centre: centred(w, h, SITE.cx, 70),
			starboard: centred(w, h, SITE.cx, 48, true),
		},
	};
}

function sensorSlot(
	key: string,
	label: string,
	assetType: string,
	art: string,
	size: [number, number],
	extra: Partial<AttachedSlot> = {},
): AttachedSlot {
	const { fallback, placements } = sensorPlacements(size[0], size[1]);
	return {
		key,
		label,
		assetType,
		art,
		parent: "body",
		dx: fallback.dx,
		dy: fallback.dy,
		rotate: fallback.rotate,
		placements,
		// Where a sensor sits varies glider to glider, so an empty slot would
		// mean a dashed box in the wrong place half the time. Not drawn.
		optional: true,
		...extra,
	};
}

const INLINE_SLOTS: InlineSlot[] = [
	{
		key: "body",
		label: "Seaglider",
		assetType: "glider",
		art: "body",
		dy: 0,
		base: true,
	},
];

// Drawn in this order, which is also the z-order (later is on top).
const ATTACHED_SLOTS: AttachedSlot[] = [
	{
		// Every Seaglider has one; the Argos tag clamps onto it.
		key: "antenna",
		label: "Antenna",
		assetType: "antenna",
		art: "antenna",
		parent: "body",
		dx: -235,
		dy: 65,
		base: true,
	},
	{
		key: "argos_tag",
		label: "Argos tag",
		assetType: "argos_tag",
		art: "argos_tag",
		parent: "antenna",
		dx: 35,
		dy: -4,
		optional: true,
	},
	// Batteries are shown as the sketch has them: internal, drawn over the
	// hull. Positions reuse the portal's battery positions: fore = primary
	// (the big forward pack), aft = secondary.
	{
		key: "battery_primary",
		label: "Primary battery",
		assetType: "battery",
		positions: ["fore"],
		art: "battery_primary",
		parent: "body",
		dx: 356,
		// 96 tall, centred on the hull axis (y=71 here).
		dy: 23,
	},
	{
		key: "battery_secondary",
		label: "Secondary battery",
		assetType: "battery",
		positions: ["aft"],
		art: "battery_secondary",
		parent: "body",
		dx: 553,
		dy: 55,
	},
	{
		// The CT sail stands on the hull top at the aft edge of the fairing,
		// its sensor arm pointing aft. Every Seaglider has one (a dashed
		// outline holds the place when it is missing). An RBR legato is also
		// a CT sensor, so it is told apart by its model.
		key: "ct_sail",
		label: "CT sail",
		assetType: "ct_sensor",
		match: (c) => !isLegato(c),
		art: "ct_sail",
		parent: "body",
		dx: 267,
		dy: -40,
	},
	sensorSlot("legato", "RBR legato", "ct_sensor", "rbr_legato", [90, 24], {
		match: isLegato,
	}),
	sensorSlot("eco_sensor", "ECO puck", "eco_sensor", "eco_puck", [60, 14]),
	sensorSlot("eco_sensor_2", "ECO puck", "eco_sensor", "eco_puck", [60, 14]),
	sensorSlot("do_sensor", "DO sensor", "do_sensor", "do_sensor", [46, 20]),
	sensorSlot("do_sensor_2", "DO sensor", "do_sensor", "do_sensor", [46, 20]),
];

export const SEAGLIDER_M2: DiagramSpec = {
	inline: INLINE_SLOTS,
	attached: ATTACHED_SLOTS,
	parts: PARTS,
	// Drawn nose-right, shown nose-left like the Slocum.
	mirror: true,
};

export function layoutSeagliderM2(
	components: GliderBuildComponent[],
): DiagramLayout {
	return layoutDiagram(SEAGLIDER_M2, components);
}
