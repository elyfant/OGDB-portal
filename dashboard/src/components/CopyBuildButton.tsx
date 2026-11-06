"use client";

import { copyMissionBuild } from "@/lib/api-client";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Brings this mission's build in step with another mission of the same
// glider -- how a scheduled mission is lined up with the previous one, or a
// mission with no recorded build gets one. It REPLACES the build, so the
// dialog says so before anything happens.
export default function CopyBuildButton({
	missionId,
	sources,
	primary = false,
}: {
	missionId: number;
	// The glider's other missions, newest first.
	sources: { id: number; label: string }[];
	// Emphasised when the mission has no build at all.
	primary?: boolean;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [sourceId, setSourceId] = useState<number | "">("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (sources.length === 0) return null;

	async function copy() {
		if (!sourceId) return;
		setSaving(true);
		setError(null);
		try {
			await copyMissionBuild(missionId, sourceId);
			setOpen(false);
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to copy build.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<Button
				variant={primary ? "contained" : "outlined"}
				size="small"
				startIcon={<ContentCopyIcon fontSize="small" />}
				onClick={() => setOpen(true)}
			>
				Copy build from…
			</Button>
			<Dialog
				open={open}
				onClose={() => setOpen(false)}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle>Copy build from another mission</DialogTitle>
				<DialogContent dividers>
					<Alert severity="warning" sx={{ mb: 2 }}>
						This replaces everything in this mission's build with a copy of the
						one you pick. The other mission is not changed.
					</Alert>
					<TextField
						select
						fullWidth
						size="small"
						label="Copy from"
						value={sourceId}
						onChange={(e) => setSourceId(Number(e.target.value))}
					>
						{sources.map((s) => (
							<MenuItem key={s.id} value={s.id}>
								{s.label}
							</MenuItem>
						))}
					</TextField>
					{error && (
						<Typography color="error" variant="body2" sx={{ mt: 2 }}>
							{error}
						</Typography>
					)}
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setOpen(false)} disabled={saving}>
						Cancel
					</Button>
					<Button
						variant="contained"
						onClick={copy}
						disabled={saving || !sourceId}
					>
						{saving ? "Copying…" : "Replace build"}
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
}
