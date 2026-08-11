"use client";

import LogoutIcon from "@mui/icons-material/Logout";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import type { AuthUser } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { type MouseEvent, useState } from "react";

export default function UserMenu({ user }: { user: AuthUser }) {
	const router = useRouter();
	const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

	async function handleLogout() {
		await fetch("/api/auth/logout", { method: "POST" });
		router.push("/login");
		router.refresh();
	}

	const initial = user.email.charAt(0).toUpperCase();

	return (
		<>
			<Button
				onClick={(e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget)}
				color="inherit"
				sx={{ textTransform: "none", gap: 1 }}
			>
				<Avatar sx={{ width: 28, height: 28, fontSize: 14 }}>{initial}</Avatar>
				<Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
					{user.email}
				</Typography>
			</Button>
			<Menu
				anchorEl={anchorEl}
				open={!!anchorEl}
				onClose={() => setAnchorEl(null)}
			>
				<Box sx={{ px: 2, py: 1 }}>
					<Typography variant="body2">{user.email}</Typography>
					<Typography
						variant="caption"
						color="text.secondary"
						sx={{ textTransform: "capitalize" }}
					>
						{user.role}
					</Typography>
				</Box>
				<Divider />
				<MenuItem onClick={handleLogout}>
					<ListItemIcon>
						<LogoutIcon fontSize="small" />
					</ListItemIcon>
					Log out
				</MenuItem>
			</Menu>
		</>
	);
}
