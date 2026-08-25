"use client";

import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import type { ReactNode } from "react";
import { useState } from "react";

// Tabs sit below the name/status header (not above it) -- that header is
// shared chrome that doesn't change per tab, so it's rendered once by
// the page, above this component, rather than duplicated into each
// panel here.
export default function GliderDetailTabs({
	overview,
	timeline,
}: {
	overview: ReactNode;
	timeline: ReactNode;
}) {
	const [tab, setTab] = useState<"overview" | "timeline">("overview");

	return (
		<Box>
			<Tabs
				value={tab}
				onChange={(_, value) => setTab(value)}
				sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
			>
				<Tab label="Overview" value="overview" />
				<Tab label="Timeline" value="timeline" />
			</Tabs>
			{tab === "overview" ? overview : timeline}
		</Box>
	);
}
