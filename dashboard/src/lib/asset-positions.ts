// Allowed position values, for the asset types where the position means
// something -- the glider diagram places hulls, batteries and sensors by it.
// "pitch" is deliberately not here: it names a battery *model*, never a
// location.
//
// Keep in step with the lists in gateway/src/gliders/build.helpers.ts, which
// enforces them -- @ogdb/types is types-only at runtime, so they can't be
// shared from there.

// REQUIRED when the part is added: a hull or battery with no position can't
// be drawn.
export const ASSET_POSITIONS: Record<string, readonly string[]> = {
	slocum_hull: ["fore", "energy", "aft"],
	battery: ["fore", "energy", "aft"],
};

// Where a sensor sits on a Seaglider is the user's choice. "Hatch" is the
// pair of mounting hatches on the hull top and underside; port/starboard are
// the flanks, centre the middle of the hull side.
export const SENSOR_POSITIONS = [
	"upper hatch",
	"lower hatch",
	"starboard",
	"port",
	"centre",
] as const;

// OPTIONAL: may be left empty (a Slocum's CT sensor has no location), and
// when given must be one of these.
export const OPTIONAL_POSITIONS: Record<string, readonly string[]> = {
	ct_sensor: SENSOR_POSITIONS,
	do_sensor: SENSOR_POSITIONS,
	eco_sensor: SENSOR_POSITIONS,
};

export function positionLabel(position: string): string {
	return position[0].toUpperCase() + position.slice(1);
}
