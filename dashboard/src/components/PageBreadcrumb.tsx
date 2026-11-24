import Breadcrumbs from "@mui/material/Breadcrumbs";
import Typography from "@mui/material/Typography";
import Link from "next/link";

export default function PageBreadcrumb({
	catalogue,
	catalogueHref,
	current,
	small = false,
}: {
	catalogue: string;
	catalogueHref: string;
	current: string;
	// Smaller type, for pages where the breadcrumb should stay in the
	// background (mission detail).
	small?: boolean;
}) {
	return (
		<Breadcrumbs sx={{ mb: 1, ...(small && { fontSize: "0.8125rem" }) }}>
			<Link
				href={catalogueHref}
				style={{ textDecoration: "none", color: "inherit" }}
			>
				{catalogue}
			</Link>
			<Typography variant="inherit" color="text.primary">
				{current}
			</Typography>
		</Breadcrumbs>
	);
}
