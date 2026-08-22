"use client";

import type { SvgIconComponent } from "@mui/icons-material";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { useRouter } from "next/navigation";

export default function ChampionshipCard({
	icon: Icon,
	title,
	winner,
	detail,
	href,
	tooltip,
}: {
	icon: SvgIconComponent;
	title: string;
	winner: string;
	detail: string | string[];
	href?: string;
	tooltip?: string;
}) {
	const theme = useTheme();
	const router = useRouter();
	const color = theme.palette.primary.main;
	const detailLines = Array.isArray(detail) ? detail : [detail];

	const card = (
		<Paper
			elevation={0}
			onClick={href ? () => router.push(href) : undefined}
			sx={{
				width: "100%",
				p: 3,
				textAlign: "center",
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
					width: 56,
					height: 56,
					mx: "auto",
					mb: 1.5,
					borderRadius: "50%",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: `${color}1f`,
				}}
			>
				<Icon sx={{ color, fontSize: 30 }} />
			</Box>
			<Typography
				variant="subtitle2"
				sx={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}
			>
				{title}
			</Typography>
			<Divider sx={{ my: 1.5, mx: "auto", width: "60%" }} />
			<Typography
				variant="h5"
				sx={{ fontWeight: 700, textTransform: "capitalize" }}
			>
				{winner}
			</Typography>
			{detailLines.map((line) => (
				<Typography key={line} variant="body2" color="text.secondary">
					{line}
				</Typography>
			))}
		</Paper>
	);

	if (!href) {
		return <Box sx={{ flex: "1 1 260px" }}>{card}</Box>;
	}
	return (
		<Box sx={{ flex: "1 1 260px" }}>
			<Tooltip title={tooltip ?? ""}>{card}</Tooltip>
		</Box>
	);
}
