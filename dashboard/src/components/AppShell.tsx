"use client";

import ConnectingAirports from "@mui/icons-material/ConnectingAirports";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat";
import HomeIcon from "@mui/icons-material/Home";
import InsightsIcon from "@mui/icons-material/Insights";
import LightModeIcon from "@mui/icons-material/LightMode";
import RouteIcon from "@mui/icons-material/Route";
import SensorsIcon from "@mui/icons-material/Sensors";
import TopicIcon from "@mui/icons-material/Topic";
import WidgetsIcon from "@mui/icons-material/Widgets";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import type { AuthUser } from "@ogdb/types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useColorMode } from "../theme/ThemeRegistry";
import UserMenu from "./UserMenu";

const DRAWER_WIDTH = 240;

const NAV_GROUPS = [
	{
		label: "Home",
		items: [
			{ label: "Home", href: "/", icon: HomeIcon },
			{ label: "Mission Stats", href: "/mission-stats", icon: InsightsIcon },
		],
	},
	{
		label: "Assets",
		items: [
			{ label: "Glider fleet", href: "/gliders", icon: ConnectingAirports },
			{ label: "All assets", href: "/assets", icon: WidgetsIcon },
		],
	},
	{
		label: "Operations",
		items: [
			{ label: "Missions", href: "/missions", icon: RouteIcon },
			{ label: "Cruises", href: "/cruises", icon: DirectionsBoatIcon },
			{ label: "Datasets", href: "/datasets", icon: TopicIcon },
		],
	},
	{
		label: "Calibrations",
		items: [
			{ label: "Calibrations", href: "/calibrations", icon: SensorsIcon },
		],
	},
];

function isActive(pathname: string, href: string) {
	return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export default function AppShell({
	children,
	user,
}: {
	children: ReactNode;
	user: AuthUser;
}) {
	const { mode, toggle } = useColorMode();
	const pathname = usePathname();

	return (
		<Box sx={{ display: "flex" }}>
			<AppBar
				position="fixed"
				sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
			>
				<Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
					<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
						<Typography variant="h6" noWrap letterSpacing={2}>
							OGDB PORTAL
						</Typography>
						<Chip
							label="BETA"
							size="small"
							color="primary"
							variant="outlined"
						/>
					</Box>
					<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
						<UserMenu user={user} />
						<IconButton onClick={toggle} color="inherit">
							{mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
						</IconButton>
					</Box>
				</Toolbar>
			</AppBar>
			<Drawer
				variant="permanent"
				sx={{
					width: DRAWER_WIDTH,
					flexShrink: 0,
					"& .MuiDrawer-paper": {
						width: DRAWER_WIDTH,
						boxSizing: "border-box",
					},
				}}
			>
				<Toolbar />
				<Box sx={{ overflow: "auto", pt: 1 }}>
					{NAV_GROUPS.map((group, i) => (
						<Box key={group.label}>
							{i > 0 && <Divider />}
							<Typography
								variant="overline"
								sx={{ pl: 2, color: "primary.main", fontWeight: 600 }}
							>
								{group.label}
							</Typography>
							<List>
								{group.items.map(({ label, href, icon: Icon }) => {
									const selected = isActive(pathname, href);
									return (
										<ListItemButton
											key={href}
											component={Link}
											href={href}
											selected={selected}
										>
											<ListItemIcon>
												<Icon color={selected ? "primary" : "inherit"} />
											</ListItemIcon>
											<ListItemText primary={label} />
										</ListItemButton>
									);
								})}
							</List>
						</Box>
					))}
					<Divider />
				</Box>
			</Drawer>
			<Box component="main" sx={{ flexGrow: 1, p: 3 }}>
				<Toolbar />
				{children}
			</Box>
		</Box>
	);
}
