"use client";

import type { SvgIconComponent } from "@mui/icons-material";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { useRouter } from "next/navigation";
import { STAT_COLOR_ROLES, type StatColorRole } from "../lib/stat-colors";

export default function StatTile({
	label,
	value,
	icon: Icon,
	colorRole,
	href,
	tooltip,
}: {
	label: string;
	value: string;
	icon: SvgIconComponent;
	colorRole: StatColorRole;
	href?: string;
	tooltip?: string;
}) {
	const theme = useTheme();
	const router = useRouter();
	const color = STAT_COLOR_ROLES[colorRole][theme.palette.mode];

	const tile = (
		<Paper
			elevation={0}
			onClick={href ? () => router.push(href) : undefined}
			sx={{
				width: "100%",
				display: "flex",
				alignItems: "center",
				gap: 2,
				p: 2.5,
				border: "1px solid",
				borderColor: "divider",
				borderRadius: 3,
				...(href && {
					cursor: "pointer",
					transition: "border-color 0.15s, box-shadow 0.15s",
					"&:hover": {
						borderColor: "primary.main",
						boxShadow: 1,
					},
				}),
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

	if (!href) {
		return <Box sx={{ flex: "1 1 200px" }}>{tile}</Box>;
	}
	return (
		<Box sx={{ flex: "1 1 200px" }}>
			<Tooltip title={tooltip ?? ""}>{tile}</Tooltip>
		</Box>
	);
}
