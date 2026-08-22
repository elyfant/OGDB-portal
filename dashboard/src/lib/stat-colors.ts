export const STAT_COLOR_ROLES = {
	blue: { light: "#2a78d6", dark: "#3987e5" },
	orange: { light: "#eb6834", dark: "#d95926" },
	aqua: { light: "#1baf7a", dark: "#199e70" },
	yellow: { light: "#eda100", dark: "#c98500" },
	// Same categorical family as the four above (continuing the same
	// colorblind-safe ordering) -- added for charts that need more than
	// four identities at once, e.g. one color per glider on Mission Stats.
	magenta: { light: "#e87ba4", dark: "#d55181" },
	green: { light: "#008300", dark: "#2fbf2f" },
	violet: { light: "#4a3aa7", dark: "#9085e9" },
} as const;

export type StatColorRole = keyof typeof STAT_COLOR_ROLES;
