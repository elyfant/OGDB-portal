import Breadcrumbs from "@mui/material/Breadcrumbs";
import Typography from "@mui/material/Typography";
import Link from "next/link";

export default function PageBreadcrumb({
	catalogue,
	catalogueHref,
	current,
}: {
	catalogue: string;
	catalogueHref: string;
	current: string;
}) {
	return (
		<Breadcrumbs sx={{ mb: 1 }}>
			<Link
				href={catalogueHref}
				style={{ textDecoration: "none", color: "inherit" }}
			>
				{catalogue}
			</Link>
			<Typography color="text.primary">{current}</Typography>
		</Breadcrumbs>
	);
}
