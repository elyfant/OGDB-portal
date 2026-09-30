"use client";

import { useTheme } from "@mui/material/styles";
import { STAT_COLOR_ROLES } from "../../lib/stat-colors";

// One colour per cost bucket, the same on every Iridium chart: blue/aqua
// for the mission itself, yellow/orange for the months either side of it,
// grey for overhead (SIMs nobody's using).
export function useIridiumColors() {
	const theme = useTheme();
	const mode = theme.palette.mode;
	return {
		missionUsage: STAT_COLOR_ROLES.blue[mode],
		missionRental: STAT_COLOR_ROLES.aqua[mode],
		beforeLaunch: STAT_COLOR_ROLES.yellow[mode],
		afterRecovery: STAT_COLOR_ROLES.orange[mode],
		overhead: theme.palette.grey[mode === "dark" ? 600 : 400],
	};
}
