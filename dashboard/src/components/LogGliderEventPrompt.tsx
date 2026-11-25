"use client";

import { recordServicingEvent } from "@/lib/api-client";
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

const KIND = {
	destroyed: {
		heading: "Log destruction",
		eventType: "destroyed" as const,
		defaultTitle: "Glider destroyed",
		blurb:
			"This mission is now killed in action. Record the destruction on the glider's timeline too? That also decommissions it.",
	},
	missing: {
		heading: "Log loss of contact",
		eventType: "missing" as const,
		defaultTitle: "Contact lost",
		blurb:
			"This mission is now missing in action. Record it on the glider's timeline too, so its state reads Missing?",
	},
};

// The other half of linking a mission's outcome to its glider. Logging a
// destroyed / missing event on a glider offers to close its mission; this does
// the reverse: after a mission is saved as killed / missing in action it
// offers to log the matching event on the glider. Skippable, and it never
// touches the mission (that is already saved) -- it only logs the glider's
// event, so neither direction can loop. If the glider already has one the
// gateway says so and nothing is duplicated.
export default function LogGliderEventPrompt({
	open,
	onClose,
	gliderId,
	gliderName,
	kind,
	defaultDate,
}: {
	open: boolean;
	onClose: () => void;
	gliderId: number;
	gliderName: string;
	kind: keyof typeof KIND;
	// YYYY-MM-DD, never later than today.
	defaultDate?: string;
}) {
	const router = useRouter();
	const meta = KIND[kind];
	const [title, setTitle] = useState(meta.defaultTitle);
	const [date, setDate] = useState(today());
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [banner, setBanner] = useState<string | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: seed only when it opens
	useEffect(() => {
		if (!open) return;
		const t = today();
		setTitle(meta.defaultTitle);
		setDate(defaultDate && defaultDate < t ? defaultDate : t);
		setError(null);
	}, [open]);

	async function save() {
		if (!title.trim()) {
			setError("Give the event a short title.");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await recordServicingEvent(gliderId, {
				eventType: meta.eventType,
				title: title.trim(),
				startDate: date,
			});
			onClose();
			setBanner(`Logged on ${gliderName}'s timeline.`);
			router.refresh();
		} catch (err) {
			// Kept in the dialog, e.g. "already destroyed on …" -- in which case
			// there is nothing more to do and Skip closes it.
			setError(err instanceof Error ? err.message : "Failed to log event.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
				<DialogTitle>
					{meta.heading} — {gliderName}
				</DialogTitle>
				<DialogContent>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
						<Typography variant="body2" color="text.secondary">
							{meta.blurb}
						</Typography>
						<TextField
							label="Title"
							size="small"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							slotProps={{ htmlInput: { maxLength: 200 } }}
							fullWidth
						/>
						<TextField
							label="Date"
							type="date"
							size="small"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							slotProps={{
								inputLabel: { shrink: true },
								htmlInput: { max: today() },
							}}
							fullWidth
						/>
						{error && <Alert severity="error">{error}</Alert>}
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={onClose} disabled={saving}>
						Skip
					</Button>
					<Button
						variant="contained"
						color={kind === "destroyed" ? "error" : "primary"}
						onClick={save}
						disabled={saving}
					>
						{saving ? "Saving…" : "Log on timeline"}
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
