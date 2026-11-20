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

// A battery's position is the physical SLOT it sits in, counted from the
// nose: fore, middle, aft. What the pack is CALLED depends on the glider
// (batteryPositionLabel), so the "primary" role can sit in a different slot
// on a different glider without the stored data changing meaning:
//   Slocum   fore = Fore,      middle = Energy (optional), aft = Aft
//   SG       fore = Secondary, middle = (unused),          aft = Primary
//   SGX      fore = Secondary, middle = Primary,           aft = Aft
const SLOCUM_BATTERY_POSITIONS = ["fore", "middle", "aft"] as const;
const SEAGLIDER_BATTERY_POSITIONS = ["fore", "aft"] as const;
const SGX_BATTERY_POSITIONS = ["fore", "middle", "aft"] as const;

type BatteryPlatform = "slocum" | "seaglider" | "sgx";

function batteryPlatform(
	platform: string | null | undefined,
	platformModel: string | null | undefined,
): BatteryPlatform {
	if (platform === "seaglider") {
		return platformModel?.trim().toUpperCase() === "SGX" ? "sgx" : "seaglider";
	}
	// Slocum, or no platform known: the original names.
	return "slocum";
}

const BATTERY_POSITION_LABELS: Record<
	BatteryPlatform,
	Record<string, string>
> = {
	slocum: { fore: "Fore", middle: "Energy", aft: "Aft" },
	seaglider: { fore: "Secondary", aft: "Primary" },
	sgx: { fore: "Secondary", middle: "Primary", aft: "Aft" },
};

// The required positions for a part on this glider, or undefined when its
// type has none. Only batteries depend on the glider; with no platform known
// they get the Slocum names (the original list), same as the gateway.
export function requiredPositions(
	assetType: string,
	platform: string | null | undefined,
	platformModel: string | null | undefined,
): readonly string[] | undefined {
	if (assetType !== "battery") return ASSET_POSITIONS[assetType];
	const kind = batteryPlatform(platform, platformModel);
	if (kind === "seaglider") return SEAGLIDER_BATTERY_POSITIONS;
	return kind === "sgx" ? SGX_BATTERY_POSITIONS : SLOCUM_BATTERY_POSITIONS;
}

// What to call a position in a dropdown or message: a battery's slot gets
// this glider's name for it, everything else the capitalised position.
// Keep in step with positionLabelFor in gateway/src/gliders/build.helpers.ts.
export function positionOptionLabel(
	assetType: string,
	position: string,
	platform: string | null | undefined,
	platformModel: string | null | undefined,
): string {
	if (assetType === "battery") {
		const label =
			BATTERY_POSITION_LABELS[batteryPlatform(platform, platformModel)][
				position
			];
		if (label) return label;
	}
	return positionLabel(position);
}

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
