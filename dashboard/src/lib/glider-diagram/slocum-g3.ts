import type { GliderBuildComponent } from "@ogdb/types";
import {
	type AttachedSlot,
	type DiagramLayout,
	type DiagramSpec,
	type InlineSlot,
	type SlotDef,
	layoutDiagram,
} from "./layout";
import { PARTS } from "./slocum-g3/parts.generated";

// Slot rules for a Slocum G3 diagram. The artwork lives in slocum-g3/*.svg
// (embedded by scripts/build_glider_parts.py); this file holds what a drawing
// can't express: which asset fills which slot, and how the parts sit on one
// another. The layout engine itself is in layout.ts.

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
		positions: ["fore"],
		art: "hull_L",
		dy: 0,
	},
	{
		key: "energy_hull",
		label: "Energy hull",
		assetType: "slocum_hull",
		// "extended" is what some older data calls the energy hull; the build
		// editor only offers "energy" now. Drop this once that data is fixed.
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
		positions: ["aft"],
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
		key: "fore_battery",
		label: "Fore battery",
		assetType: "battery",
		// Positions are fore / energy / aft. "Pitch" is only a battery
		// *model* (it picks the drawing, in artFor below).
		positions: ["fore"],
		art: "battery_pitch",
		parent: "fore_hull",
		dx: 125,
		dy: 4.5,
	},
	{
		key: "forward_section",
		label: "Forward section",
		assetType: "slocum_forward_section",
		art: "forward_section",
		parent: "fore_hull",
		// The collar is the full height of the hull and sits flush with its
		// left end.
		dx: 0,
		dy: 0,
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
		// Hangs off the end cap's tail, behind the DO sensor: the nacelle
		// bolts to the end of the tail stub and the propeller trails it.
		// dy lines the nacelle up with the stub's centre line. Not every
		// glider has one, so no dashed placeholder.
		key: "thruster",
		label: "Thruster",
		assetType: "slocum_thruster",
		art: "thruster",
		parent: "end_cap",
		dx: 148,
		dy: 81,
		optional: true,
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

export const SLOCUM_G3: DiagramSpec = {
	inline: INLINE_SLOTS,
	attached: ATTACHED_SLOTS,
	parts: PARTS,
	artFor,
};

export function layoutSlocumG3(
	components: GliderBuildComponent[],
): DiagramLayout {
	return layoutDiagram(SLOCUM_G3, components);
}
