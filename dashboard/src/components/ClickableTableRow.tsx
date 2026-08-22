"use client";

import TableRow from "@mui/material/TableRow";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof TableRow> & { href: string };

export default function ClickableTableRow({ href, sx, ...props }: Props) {
	const router = useRouter();
	return (
		<TableRow
			hover
			onClick={() => router.push(href)}
			sx={{ cursor: "pointer", ...sx }}
			{...props}
		/>
	);
}
