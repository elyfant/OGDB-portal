import type { GliderBuildComponent } from "@ogdb/types";
import { PARTS } from "./slocum-g3/parts.generated";

// Slot rules and layout for a Slocum G3 diagram. The artwork lives in
// slocum-g3/*.svg (embedded by scripts/build_glider_parts.py); this file
// holds what a drawing can't express: which asset fills which slot, and how
// the parts sit on one another.
//
// The shape deliberately mirrors what two database tables would hold later:
// slots (INLINE_SLOTS / ATTACHED_SLOTS) and model -> artwork (artFor).
// Moving them into OGDB is then a straight copy, not a redesign.
//
// All sizes and offsets are deck units (1/100 inch), so the parts stay in
// proportion to each other.

interface SlotBase {
	key: string;
	label: string;
	assetType: string;
	// Aliases for asset_assignments.position (free text) that select this
	// slot. Omitted = the type alone is enough.
	positions?: string[];
	// Artwork used when the model doesn't say otherwise (and for the dashed
	// placeholder when nothing is assigned).
	art: string;
	// Only drawn when something is assigned -- no dashed placeholder. For
	// add-ons most gliders don't carry.
	optional?: boolean;
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

// Drawn on top of a parent slot, offset from the parent's top-left corner.
export interface AttachedSlot extends SlotBase {
	parent: string;
	dx: number;
	dy: number;
}

export type SlotDef = InlineSlot | AttachedSlot;

// Left to right along the glider.
export const INLINE_SLOTS: InlineSlot[] = [
	{
		key: "nose",
		label: "Altimeter",
		assetType: "slocum_altimeter",
		art: "altimeter",
		dy: 0,
	},
	{
		key: "fore_hull",
		label: "Fore hull",
		assetType: "slocum_hull",
		positions: ["fore", "forward", "fwd", "front"],
		art: "hull_L",
		dy: 0,
	},
	{
		key: "energy_hull",
		label: "Energy hull",
		assetType: "slocum_hull",
		// "extended" is what some existing data calls the energy hull.
		positions: ["energy", "extended"],
		art: "hull_1",
		dy: 0,
		// Not every glider has an energy section. But where one is fitted it
		// can be recorded as only a battery or a hull (the bay's asset isn't
		// always known), and the space still has to be there.
		presentIf: ["energy_hull", "energy_battery", "energy_bay"],
	},
	{
		key: "payload_bay",
		label: "Payload bay",
		assetType: "slocum_payload_bay",
		art: "payload_bay",
		dy: 0,
	},
	{
		key: "aft_hull",
		label: "Aft hull",
		assetType: "slocum_hull",
		positions: ["aft", "rear"],
		art: "hull_L",
		dy: 0,
	},
	{
		// The tail fin and mast rise above the hull line, so the part is
		// taller than the hull and starts above it.
		key: "end_cap",
		label: "End cap",
		assetType: "slocum_end_cap",
		art: "end_cap",
		dy: -56,
	},
];

// Drawn after the inline slots, in this order -- which is also the z-order
// (later is on top): the shafts pass over the batteries, as in the sketch.
export const ATTACHED_SLOTS: AttachedSlot[] = [
	{
		key: "pitch_battery",
		label: "Pitch battery",
		assetType: "battery",
		positions: ["pitch"],
		art: "battery_pitch",
		parent: "fore_hull",
		dx: 119,
		dy: 4.5,
	},
	{
		key: "forward_section",
		label: "Forward section",
		assetType: "slocum_forward_section",
		art: "forward_section",
		parent: "fore_hull",
		dx: 7,
		dy: 3.5,
	},
	{
		key: "energy_battery",
		label: "Energy battery",
		assetType: "battery",
		positions: ["energy"],
		art: "battery_pitch",
		parent: "energy_hull",
		dx: 35,
		dy: 4.5,
	},
	{
		key: "energy_bay",
		label: "Energy bay",
		assetType: "slocum_energy_bay",
		art: "energy_bay",
		parent: "energy_hull",
		dx: 14,
		dy: 0,
	},
	{
		key: "ct_sensor",
		label: "CT sensor",
		assetType: "ct_sensor",
		art: "ct_sensor",
		parent: "payload_bay",
		dx: 27,
		dy: 72,
	},
	{
		key: "aft_battery",
		label: "Aft battery",
		assetType: "battery",
		positions: ["aft"],
		art: "battery_aft",
		parent: "aft_hull",
		dx: 16,
		dy: 67,
	},
	{
		key: "aft_section",
		label: "Aft section",
		assetType: "slocum_aft_section",
		art: "aft_section",
		parent: "aft_hull",
		dx: 4,
		dy: 36,
	},
	{
		key: "do_sensor",
		label: "DO sensor",
		assetType: "do_sensor",
		art: "do_sensor",
		parent: "end_cap",
		dx: 84,
		dy: 106,
	},
	{
		// Floats just above the glider, its probe tips level with the left
		// end of the glider (so it hangs off the nose slot, not a hull --
		// whatever hulls are fitted, the left edge stays put). dy is the
		// part's height plus an 8-unit gap, lifting it clear of the hull.
		key: "mr_sensor",
		label: "MicroRider",
		assetType: "mr_sensor",
		art: "mr_sensor",
		parent: "nose",
		dx: 0,
		dy: -64,
		optional: true,
	},
];

// Which drawing a given asset gets. The slot's default is used unless the
// model says otherwise -- a short hull in the fore slot should look short.
function artFor(slot: SlotDef, component: GliderBuildComponent | null): string {
	const model = component?.model ?? "";
	if (slot.assetType === "slocum_hull") {
		if (/G-1405-L\b/i.test(model)) return "hull_L";
		if (/G-1405-1\b/i.test(model)) return "hull_1";
	}
	if (slot.assetType === "battery") {
		if (/aft/i.test(model)) return "battery_aft";
		if (/pitch/i.test(model)) return "battery_pitch";
	}
	return slot.art;
}

export interface PlacedPart {
	slot: SlotDef;
	component: GliderBuildComponent | null;
	partId: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface DiagramLayout {
	parts: PlacedPart[];
	width: number;
	height: number;
	// Components in the build that no slot drew (thruster, Argos tag, or a
	// hull whose position matches none of the hull slots).
	notShown: GliderBuildComponent[];
}

// Assign each build component to at most one slot.
function assign(
	components: GliderBuildComponent[],
): Map<string, GliderBuildComponent> {
	const taken = new Set<number>();
	const out = new Map<string, GliderBuildComponent>();
	for (const slot of [...INLINE_SLOTS, ...ATTACHED_SLOTS]) {
		const match = components.find(
			(c) =>
				!taken.has(c.assetId) &&
				c.assetType === slot.assetType &&
				(!slot.positions ||
					slot.positions.includes((c.position ?? "").trim().toLowerCase())),
		);
		if (match) {
			taken.add(match.assetId);
			out.set(slot.key, match);
		}
	}
	return out;
}

export function layoutSlocumG3(
	components: GliderBuildComponent[],
): DiagramLayout {
	const assigned = assign(components);
	const placed = new Map<string, PlacedPart>();

	// Inline: pack left to right. Each part's own width is its advance, so a
	// longer hull pushes everything after it along.
	let cursor = 0;
	for (const slot of INLINE_SLOTS) {
		if (slot.presentIf && !slot.presentIf.some((k) => assigned.has(k)))
			continue;
		const component = assigned.get(slot.key) ?? null;
		const partId = artFor(slot, component);
		const part = PARTS[partId];
		placed.set(slot.key, {
			slot,
			component,
			partId,
			x: cursor,
			y: slot.dy,
			width: part.width,
			height: part.height,
		});
		cursor += part.width;
	}

	// Attached: offset from the parent's top-left corner.
	for (const slot of ATTACHED_SLOTS) {
		const parent = placed.get(slot.parent);
		if (!parent) continue;
		const component = assigned.get(slot.key) ?? null;
		if (slot.optional && !component) continue;
		const partId = artFor(slot, component);
		const part = PARTS[partId];
		placed.set(slot.key, {
			slot,
			component,
			partId,
			x: parent.x + slot.dx,
			y: parent.y + slot.dy,
			width: part.width,
			height: part.height,
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
	return {
		parts: parts.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY })),
		width: maxX - minX,
		height: maxY - minY,
		notShown: components.filter((c) => !shown.has(c.assetId)),
	};
}
