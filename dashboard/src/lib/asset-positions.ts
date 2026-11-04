// Allowed asset_assignments.position values, for the asset types where the
// position means something (the glider diagram places hulls and batteries by
// it). Other types keep a free-text position. "pitch" is deliberately not
// here: it names a battery *model*, never a location.
//
// Keep in step with ASSET_POSITIONS in gateway/src/gliders/build.helpers.ts,
// which enforces it -- @ogdb/types is types-only at runtime, so the list
// can't be shared from there.
export const ASSET_POSITIONS: Record<string, readonly string[]> = {
	slocum_hull: ["fore", "energy", "aft"],
	battery: ["fore", "energy", "aft"],
};

export function positionLabel(position: string): string {
	return position[0].toUpperCase() + position.slice(1);
}
