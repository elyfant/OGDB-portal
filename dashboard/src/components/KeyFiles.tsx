"use client";

import { updateMissionFolderPath } from "@/lib/api-client";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Mission folder link is deliberately just a plain clickable link (Option
// A from the earlier discussion) -- file://\\server\share links aren't
// reliably clickable across every browser, but that's a "try it and see"
// tradeoff Fiona chose over a copy-path fallback, not an oversight.
export default function KeyFiles({
	missionId,
	missionFolderPath,
}: {
	missionId: number;
	missionFolderPath: string | null;
}) {
	const router = useRouter();
	const [editing, setEditing] = useState(false);
	const [value, setValue] = useState(missionFolderPath ?? "");
	const [saving, setSaving] = useState(false);

	async function handleSave() {
		setSaving(true);
		try {
			await updateMissionFolderPath(missionId, {
				missionFolderPath: value || null,
			});
			setEditing(false);
			router.refresh();
		} finally {
			setSaving(false);
		}
	}

	return (
		<Box
			sx={{
				display: "flex",
				alignItems: "flex-start",
				justifyContent: "space-between",
				gap: 1,
			}}
		>
			<Box sx={{ minWidth: 0, flex: 1 }}>
				<Typography variant="body2" sx={{ fontWeight: 600 }}>
					Mission folder
				</Typography>
				{editing ? (
					<Box sx={{ display: "flex", gap: 1, mt: 0.5, alignItems: "center" }}>
						<TextField
							size="small"
							fullWidth
							placeholder="\\server\share\path"
							value={value}
							onChange={(e) => setValue(e.target.value)}
							sx={{ "& input": { fontFamily: "monospace", fontSize: 12 } }}
						/>
						<Button size="small" onClick={handleSave} disabled={saving}>
							Save
						</Button>
						<Button
							size="small"
							onClick={() => setEditing(false)}
							disabled={saving}
						>
							Cancel
						</Button>
					</Box>
				) : missionFolderPath ? (
					<MuiLink
						href={missionFolderPath}
						sx={{
							fontFamily: "monospace",
							fontSize: 12,
							wordBreak: "break-all",
							display: "block",
						}}
					>
						{missionFolderPath}
					</MuiLink>
				) : (
					<Typography variant="caption" color="text.disabled">
						Not set
					</Typography>
				)}
			</Box>
			{!editing && (
				<IconButton size="small" onClick={() => setEditing(true)}>
					<EditIcon fontSize="small" />
				</IconButton>
			)}
		</Box>
	);
}
