"use client";

import { resolveServicingRequired } from "@/lib/api-client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Local calendar day as YYYY-MM-DD.
function today(): string {
	return new Date().toLocaleDateString("en-CA");
}

// "The repair is done": takes the servicing-required flag (the red chip) off.
// This only sets the event's end date -- the event itself STAYS on the
// timeline as a closed span, so what was wrong, when it was raised and when it
// was fixed remain on record. An optional note on what was done is appended to
// the event's description.
export default function ResolveServicingDialog({
	open,
	onClose,
	assetId,
	eventId,
	assetLabel,
	title,
	startDate,
}: {
	open: boolean;
	onClose: () => void;
	assetId: number;
	eventId: number;
	assetLabel: string;
	// What was wrong, for the reminder at the top.
	title: string | null;
	// YYYY-MM-DD it was raised: the earliest it can have been fixed.
	startDate: string;
}) {
	const router = useRouter();
	const [date, setDate] = useState(today());
	const [note, setNote] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [banner, setBanner] = useState<string | null>(null);

	useEffect(() => {
		if (!open) return;
		setDate(today());
		setNote("");
		setError(null);
	}, [open]);

	async function save() {
		setSaving(true);
		setError(null);
		try {
			await resolveServicingRequired(assetId, eventId, {
				date: date || undefined,
				note: note.trim() || undefined,
			});
			onClose();
			setBanner(`${assetLabel} is no longer flagged servicing required.`);
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to resolve.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
				<DialogTitle>Resolve servicing required — {assetLabel}</DialogTitle>
				<DialogContent>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
						{title && (
							<Typography variant="body2">
								<strong>{title}</strong>
							</Typography>
						)}
						<Typography variant="body2" color="text.secondary">
							Use this once the repair is done. The red tag comes off, but the
							event stays on the timeline as a record. It does not put the
							glider back to "cleared to deploy": that logsheet needs clearing
							again.
						</Typography>
						<TextField
							label="Resolved on"
							type="date"
							size="small"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							slotProps={{
								inputLabel: { shrink: true },
								htmlInput: { min: startDate.slice(0, 10), max: today() },
							}}
							fullWidth
						/>
						<TextField
							label="What was done (optional)"
							size="small"
							multiline
							minRows={3}
							value={note}
							onChange={(e) => setNote(e.target.value.slice(0, 1000))}
							helperText={`${note.length} / 1000`}
							fullWidth
						/>
						{error && <Alert severity="error">{error}</Alert>}
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={onClose} disabled={saving}>
						Cancel
					</Button>
					<Button variant="contained" onClick={save} disabled={saving}>
						{saving ? "Saving…" : "Resolve"}
					</Button>
				</DialogActions>
			</Dialog>

			<Snackbar
				open={banner !== null}
				autoHideDuration={4000}
				onClose={() => setBanner(null)}
				anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
			>
				<Alert severity="success" variant="filled">
					{banner}
				</Alert>
			</Snackbar>
		</>
	);
}
