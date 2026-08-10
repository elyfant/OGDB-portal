"use client";

import type { SvgIconComponent } from "@mui/icons-material";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { STAT_COLOR_ROLES, type StatColorRole } from "../lib/stat-colors";

export default function StatTile({
	label,
	value,
	icon: Icon,
	colorRole,
}: {
	label: string;
	value: string;
	icon: SvgIconComponent;
	colorRole: StatColorRole;
}) {
	const theme = useTheme();
	const color = STAT_COLOR_ROLES[colorRole][theme.palette.mode];

	return (
		<Paper
			elevation={0}
			sx={{
				flex: "1 1 200px",
				display: "flex",
				alignItems: "center",
				gap: 2,
				p: 2.5,
				border: "1px solid",
				borderColor: "divider",
				borderRadius: 3,
			}}
		>
			<Box
				sx={{
					width: 52,
					height: 52,
					borderRadius: "50%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					flexShrink: 0,
					backgroundColor: `${color}22`,
				}}
			>
				<Icon sx={{ color, fontSize: 28 }} />
			</Box>
			<Box>
				<Typography
					variant="h4"
					sx={{
						fontWeight: 600,
						lineHeight: 1.1,
						fontVariantNumeric: "proportional-nums",
					}}
				>
					{value}
				</Typography>
				<Typography variant="body2" color="text.secondary">
					{label}
				</Typography>
			</Box>
		</Paper>
	);
}
