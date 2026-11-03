import type { GliderBuildComponent } from "@ogdb/types";
import { PARTS, REFERENCE_LAYOUT } from "./slocum-g3/parts.generated";

// Slot rules and layout for a Slocum G3 diagram. The artwork and the
// reference positions are generated from the PowerPoint deck (see
// dashboard/scripts/pptx_to_glider_parts.py); this file holds the rules the
// deck can't express: which asset fills which slot, and how to place it.
//
// The shape deliberately mirrors what two database tables would hold later:
// slots (this file's SLOTS) and model -> artwork (artFor). Moving them into
// OGDB is then a straight copy, not a redesign.

export interface SlotDef {
	key: string;
	label: string;
	assetType: string;
	// Aliases for asset_assignments.position (free text) that select this
	// slot. Omitted = the type alone is enough.
	positions?: string[];
	// Attached slots are placed relative to their parent slot; inline slots
	// are packed left to right along the hull axis.
	parent?: string;
}

// Left to right along the glider.
export const INLINE_SLOTS: SlotDef[] = [
	{ key: "nose", label: "Altimeter", assetType: "slocum_altimeter" },
	{
		key: "fore_hull",
		label: "Fore hull",
		assetType: "slocum_hull",
		positions: ["fore"],
	},
	{
		key: "energy_hull",
		label: "Energy hull",
		assetType: "slocum_hull",
		// "extended" is what some existing data calls the energy hull.
		positions: ["energy", "extended"],
	},
	{
		key: "payload_bay",
		label: "Payload bay",
		assetType: "slocum_payload_bay",
	},
	{
		key: "aft_hull",
		label: "Aft hull",
		assetType: "slocum_hull",
		positions: ["aft"],
	},
	{ key: "end_cap", label: "End cap", assetType: "slocum_end_cap" },
];

// Drawn after the inline slots, in this order (it's also the z-order: later
// is on top, matching the deck).
export const ATTACHED_SLOTS: SlotDef[] = [
	{
		key: "pitch_battery",
		label: "Pitch battery",
		assetType: "battery",
		positions: ["pitch"],
		parent: "fore_hull",
	},
	{
		key: "forward_section",
		label: "Forward section",
		assetType: "slocum_forward_section",
		parent: "fore_hull",
	},
	{
		key: "energy_battery",
		label: "Energy battery",
		assetType: "battery",
		positions: ["energy"],
		parent: "energy_hull",
	},
	{
		key: "energy_bay",
		label: "Energy bay",
		assetType: "slocum_energy_bay",
		parent: "energy_hull",
	},
	{
		key: "ct_sensor",
		label: "CT sensor",
		assetType: "ct_sensor",
		parent: "payload_bay",
	},
	{
		key: "aft_battery",
		label: "Aft battery",
		assetType: "battery",
		positions: ["aft"],
		parent: "aft_hull",
	},
	{
		key: "aft_section",
		label: "Aft section",
		assetType: "slocum_aft_section",
		parent: "aft_hull",
	},
	{
		key: "do_sensor",
		label: "DO sensor",
		assetType: "do_sensor",
		parent: "end_cap",
	},
];

// Which drawing a given asset gets. The slot's default (from the deck) is
// used unless the model says otherwise -- a short hull in the fore slot
// should look short.
function artFor(slot: SlotDef, component: GliderBuildComponent | null): string {
	const fallback = REFERENCE_LAYOUT[slot.key].part;
	const model = component?.model ?? "";
	if (slot.assetType === "slocum_hull") {
		if (/G-1405-L\b/i.test(model)) return "hull_L";
		if (/G-1405-1\b/i.test(model)) return "hull_1";
	}
	if (slot.assetType === "battery") {
		if (/aft/i.test(model)) return "battery_aft";
		if (/pitch/i.test(model)) return "battery_pitch";
	}
	return fallback;
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
	// Components in the build that no slot drew (thruster, Argos tag, ...).
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

	// Inline: pack left to right. Each part's advance is its own width minus
	// the overlap the deck drew between it and the next part, so a longer
	// hull pushes everything after it along.
	const refTop = REFERENCE_LAYOUT.fore_hull.y;
	let cursor = 0;
	INLINE_SLOTS.forEach((slot, i) => {
		const component = assigned.get(slot.key) ?? null;
		const partId = artFor(slot, component);
		const part = PARTS[partId];
		const ref = REFERENCE_LAYOUT[slot.key];
		placed.set(slot.key, {
			slot,
			component,
			partId,
			x: cursor,
			y: ref.y - refTop,
			width: part.width,
			height: part.height,
		});
		const next = INLINE_SLOTS[i + 1];
		const overlap = next
			? ref.x + PARTS[ref.part].width - REFERENCE_LAYOUT[next.key].x
			: 0;
		cursor += part.width - overlap;
	});

	// Attached: offset from the parent by whatever the deck drew.
	for (const slot of ATTACHED_SLOTS) {
		const parent = placed.get(slot.parent as string);
		if (!parent) continue;
		const component = assigned.get(slot.key) ?? null;
		const partId = artFor(slot, component);
		const part = PARTS[partId];
		const ref = REFERENCE_LAYOUT[slot.key];
		const parentRef = REFERENCE_LAYOUT[parent.slot.key];
		placed.set(slot.key, {
			slot,
			component,
			partId,
			x: parent.x + (ref.x - parentRef.x),
			y: parent.y + (ref.y - parentRef.y),
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
