"use client";

import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import type { ReactNode } from "react";
import { useState } from "react";

// Same tab styling as GliderDetailTabs. The tab bar only appears when the
// mission has a second tab to show (the Seaglider refurbishment logsheet);
// every other mission renders its overview alone, as before.
export default function MissionDetailTabs({
	overview,
	refurbishment,
}: {
	overview: ReactNode;
	// null = this mission has no logsheet tab.
	refurbishment: ReactNode | null;
}) {
	const [tab, setTab] = useState<"overview" | "refurbishment">("overview");

	if (refurbishment === null) return <Box>{overview}</Box>;

	return (
		<Box>
			<Tabs
				value={tab}
				onChange={(_, value) => setTab(value)}
				sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
			>
				<Tab label="Overview" value="overview" />
				<Tab label="Refurb logsheet" value="refurbishment" />
			</Tabs>
			{tab === "overview" ? overview : refurbishment}
		</Box>
	);
}
