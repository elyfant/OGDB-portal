import type { GliderBuildComponent } from "@ogdb/types";

// The layout engine shared by every glider drawing. A drawing is a
// DiagramSpec: slots (which asset fills which place), the artwork parts, and
// a rule for which artwork a given asset gets. The Slocum and the Seaglider
// each supply one; this file turns a build into placed parts.
//
// The shape deliberately mirrors what database tables would hold later:
// slots, and model -> artwork. Moving them into OGDB is then a straight
// copy, not a redesign.
//
// All sizes and offsets are deck units (1/100 inch), so the parts stay in
// proportion to each other.

export interface DiagramPart {
	/** Size in deck units (1/100 inch). */
	width: number;
	height: number;
	/** SVG markup, origin at the part's top-left. */
	svg: string;
}

interface SlotBase {
	key: string;
	label: string;
	assetType: string;
	// Aliases for the build item's position (free text) that select this
	// slot. Omitted = the type alone is enough.
	positions?: string[];
	// Narrows a slot beyond type and position -- e.g. an RBR legato and a CT
	// sail are both CT sensors; only the model tells them apart.
	match?: (component: GliderBuildComponent) => boolean;
	// Artwork used when the model doesn't say otherwise (and for the dashed
	// placeholder when nothing is assigned).
	art: string;
	// Only drawn when something is assigned -- no dashed placeholder. For
	// add-ons most gliders don't carry.
	optional?: boolean;
	// Always drawn and never an asset: the glider's own body (a Seaglider's
	// hull is the glider itself, not a part in the build). Not clickable,
	// never a dashed placeholder.
	base?: boolean;
}

// Packed left to right along the hull axis.
export interface InlineSlot extends SlotBase {
	// Vertical offset from the top of the hull.
	dy: number;
	// The section only exists if at least one of these slots has something
	// assigned (this slot's own key counts). Otherwise it is left out
	// altogether and its neighbours touch. Once it exists, any of its slots
	// still empty show as dashed outlines, so the space is held.
	presentIf?: string[];
}

// Where an attached part sits, relative to its parent's top-left corner.
export interface Placement {
	dx: number;
	dy: number;
	// Drawn faded: it is on the far side of the glider, seen through it.
	ghost?: boolean;
	// Degrees clockwise about the part's centre, so a flat sensor lies along a
	// sloping hull instead of floating off one end of it.
	rotate?: number;
	// Mirrored top to bottom: something mounted on the underside faces down.
	flip?: boolean;
}

// Drawn on top of a parent slot, offset from the parent's top-left corner.
export interface AttachedSlot extends SlotBase, Placement {
	parent: string;
	// Where the part goes for each position the user can choose (the key is
	// the build item's position, lower case). dx/dy above are the fallback
	// when no position is recorded or none matches.
	placements?: Record<string, Placement>;
}

export type SlotDef = InlineSlot | AttachedSlot;

export interface DiagramSpec {
	// Left to right along the glider.
	inline: InlineSlot[];
	// Drawn after the inline slots, in this order -- which is also the
	// z-order (later is on top).
	attached: AttachedSlot[];
	parts: Record<string, DiagramPart>;
	// Which drawing a given asset gets. The slot's default is used unless the
	// model says otherwise.
	artFor?: (slot: SlotDef, component: GliderBuildComponent | null) => string;
	// The drawing is laid out and drawn with the nose on the right; this turns
	// the finished picture around so the nose points left, as on the Slocum.
	// Offsets, tilts and artwork are all written in the unmirrored frame.
	mirror?: boolean;
}

export interface PlacedPart {
	slot: SlotDef;
	component: GliderBuildComponent | null;
	partId: string;
	x: number;
	y: number;
	width: number;
	height: number;
	ghost: boolean;
	rotate: number;
	flip: boolean;
	// Artwork turned left-right (the whole drawing is mirrored).
	mirrorX: boolean;
}

export interface DiagramLayout {
	parts: PlacedPart[];
	width: number;
	height: number;
	// Components in the build that no slot drew (e.g. a hull whose position
	// matches none of the hull slots, or a third sensor of a kind).
	notShown: GliderBuildComponent[];
}

const normPosition = (c: GliderBuildComponent | null): string =>
	(c?.position ?? "").trim().toLowerCase();

// Assign each build component to at most one slot.
function assign(
	spec: DiagramSpec,
	components: GliderBuildComponent[],
): Map<string, GliderBuildComponent> {
	const taken = new Set<number>();
	const out = new Map<string, GliderBuildComponent>();
	for (const slot of [...spec.inline, ...spec.attached]) {
		const match = components.find(
			(c) =>
				!taken.has(c.assetId) &&
				c.assetType === slot.assetType &&
				(!slot.positions || slot.positions.includes(normPosition(c))) &&
				(!slot.match || slot.match(c)),
		);
		if (match) {
			taken.add(match.assetId);
			out.set(slot.key, match);
		}
	}
	return out;
}

export function layoutDiagram(
	spec: DiagramSpec,
	components: GliderBuildComponent[],
): DiagramLayout {
	const assigned = assign(spec, components);
	const placed = new Map<string, PlacedPart>();
	const artFor = spec.artFor ?? ((slot: SlotDef) => slot.art);

	// Inline: pack left to right. Each part's own width is its advance, so a
	// longer hull pushes everything after it along.
	let cursor = 0;
	for (const slot of spec.inline) {
		if (slot.presentIf && !slot.presentIf.some((k) => assigned.has(k)))
			continue;
		const component = assigned.get(slot.key) ?? null;
		const partId = artFor(slot, component);
		const part = spec.parts[partId];
		placed.set(slot.key, {
			slot,
			component,
			partId,
			x: cursor,
			y: slot.dy,
			width: part.width,
			height: part.height,
			ghost: false,
			rotate: 0,
			flip: false,
			mirrorX: false,
		});
		cursor += part.width;
	}

	// Attached: offset from the parent's top-left corner.
	for (const slot of spec.attached) {
		const parent = placed.get(slot.parent);
		if (!parent) continue;
		const component = assigned.get(slot.key) ?? null;
		if (slot.optional && !component) continue;
		const partId = artFor(slot, component);
		const part = spec.parts[partId];
		const at = slot.placements?.[normPosition(component)] ?? slot;
		placed.set(slot.key, {
			slot,
			component,
			partId,
			x: parent.x + at.dx,
			y: parent.y + at.dy,
			width: part.width,
			height: part.height,
			ghost: at.ghost ?? false,
			rotate: at.rotate ?? 0,
			flip: at.flip ?? false,
			mirrorX: false,
		});
	}

	const parts = [...placed.values()];
	const minX = Math.min(...parts.map((p) => p.x));
	const minY = Math.min(...parts.map((p) => p.y));
	const maxX = Math.max(...parts.map((p) => p.x + p.width));
	const maxY = Math.max(...parts.map((p) => p.y + p.height));
	const shown = new Set(
		parts.flatMap((p) => (p.component ? [p.component.assetId] : [])),
	);
	const width = maxX - minX;
	const mirror = spec.mirror ?? false;
	return {
		parts: parts.map((p) => ({
			...p,
			x: mirror ? width - (p.x - minX) - p.width : p.x - minX,
			y: p.y - minY,
			// A mirrored picture tilts the other way.
			rotate: mirror ? -p.rotate : p.rotate,
			mirrorX: mirror,
		})),
		width,
		height: maxY - minY,
		notShown: components.filter((c) => !shown.has(c.assetId)),
	};
}
