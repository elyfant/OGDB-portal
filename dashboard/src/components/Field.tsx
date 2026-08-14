import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

export default function Field({
	label,
	value,
}: {
	label: string;
	value: ReactNode;
}) {
	return (
		<Box>
			<Typography variant="caption" color="text.secondary" display="block">
				{label}
			</Typography>
			<Typography>{value ?? "—"}</Typography>
		</Box>
	);
}
