"use client";

import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

export default function ChartCard({
	title,
	description,
	action,
	children,
}: {
	title: string;
	description?: string;
	action?: ReactNode;
	children: ReactNode;
}) {
	return (
		<Paper
			elevation={0}
			sx={{
				p: 3,
				border: "1px solid",
				borderColor: "divider",
				borderRadius: 3,
			}}
		>
			<Box
				sx={{
					display: "flex",
					alignItems: "flex-start",
					justifyContent: "space-between",
					gap: 2,
					flexWrap: "wrap",
					mb: 1.5,
				}}
			>
				<Box>
					<Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
						{title}
					</Typography>
					{description && (
						<Typography variant="body2" color="text.secondary">
							{description}
						</Typography>
					)}
				</Box>
				{action}
			</Box>
			{children}
		</Paper>
	);
}
