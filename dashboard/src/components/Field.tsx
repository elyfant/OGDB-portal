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
			{/* component="div", not the default <p> — value can contain block-level
			    content (e.g. NvsValue's Box), which isn't valid inside a <p> and
			    causes a hydration mismatch */}
			<Typography component="div">{value ?? "—"}</Typography>
		</Box>
	);
}
