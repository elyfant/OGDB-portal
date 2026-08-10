export const STAT_COLOR_ROLES = {
	blue: { light: "#2a78d6", dark: "#3987e5" },
	orange: { light: "#eb6834", dark: "#d95926" },
	aqua: { light: "#1baf7a", dark: "#199e70" },
	yellow: { light: "#eda100", dark: "#c98500" },
} as const;

export type StatColorRole = keyof typeof STAT_COLOR_ROLES;
