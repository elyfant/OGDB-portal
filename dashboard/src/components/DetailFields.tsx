import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactNode } from "react";

export default function DetailFields({
	fields,
}: {
	fields: { label: string; value: ReactNode }[];
}) {
	return (
		<Box
			sx={{
				display: "grid",
				gridTemplateColumns: "220px 1fr",
				rowGap: 1.25,
				columnGap: 2,
			}}
		>
			{fields.map((f) => (
				<Box key={f.label} sx={{ display: "contents" }}>
					<Typography color="text.secondary">{f.label}</Typography>
					<Typography>{f.value ?? "—"}</Typography>
				</Box>
			))}
		</Box>
	);
}
