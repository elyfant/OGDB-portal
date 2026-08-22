import { STAT_COLOR_ROLES, type StatColorRole } from "@/lib/stat-colors";

const CATEGORICAL_COLOR_ORDER: StatColorRole[] = [
	"blue",
	"orange",
	"aqua",
	"yellow",
	"magenta",
	"green",
	"violet",
];

// One color per name, taken in the order the names are given. If a list
// ever exceeds the seven roles above, colors start repeating -- deliberate,
// since a generated 8th hue can't be told apart from an existing one under
// colorblindness.
function buildColorMap(
	namesInOrder: string[],
	mode: "light" | "dark",
): Map<string, string> {
	const map = new Map<string, string>();
	namesInOrder.forEach((name, i) => {
		const role = CATEGORICAL_COLOR_ORDER[i % CATEGORICAL_COLOR_ORDER.length];
		map.set(name, STAT_COLOR_ROLES[role][mode]);
	});
	return map;
}

// One fixed color per glider, alphabetical so it's stable across renders
// and pages regardless of data order.
export function buildGliderColorMap(
	gliderNames: Iterable<string>,
	mode: "light" | "dark",
): Map<string, string> {
	const unique = Array.from(new Set(gliderNames)).sort((a, b) =>
		a.localeCompare(b),
	);
	return buildColorMap(unique, mode);
}

// One fixed color per site, in whatever order the caller supplies --
// used for the deployment timeline, where sites are ranked by total days
// rather than sorted alphabetically.
export function buildRankedColorMap(
	namesInRankOrder: string[],
	mode: "light" | "dark",
): Map<string, string> {
	return buildColorMap(namesInRankOrder, mode);
}

// Single-hue magnitude ramp in the app's own primary teal, low -> high.
// Used by every chart here that encodes a plain quantity (bar length,
// area fill, heatmap cell) rather than an identity -- kept out of the
// glider color roles above so a color on this page always means one
// thing or the other, never both.
export const MAGNITUDE_RAMP = {
	light: ["#e3f2f0", "#a8ddd4", "#5cbfb0", "#00897b", "#00695c"],
	dark: ["#16241f", "#1f4a43", "#1f6f63", "#2fb3a3", "#7fe0d1"],
} as const;

export function magnitudeColor(
	fraction: number,
	mode: "light" | "dark",
): string {
	const ramp = MAGNITUDE_RAMP[mode];
	if (fraction <= 0) return ramp[0];
	const step = Math.min(
		ramp.length - 1,
		Math.ceil(fraction * (ramp.length - 1)),
	);
	return ramp[step];
}
