"use client";

import { recordAssetLocation } from "@/lib/api-client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MuiLink from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { Location } from "@ogdb/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Local calendar day as YYYY-MM-DD (toISOString would give the UTC day,
// which is the wrong date for a few hours either side of midnight).
function today(): string {
	return new Date().toLocaleDateString("en-CA");
}

// The one form for recording where an asset is. Controlled, so it serves
// both the plain "Set / Change location" action and the skippable "Where is
// it now?" prompts that follow closing an event or recovering a glider.
//
// Entirely optional everywhere it appears: nothing in the portal requires a
// location, and "not recorded" is a normal state. In prompt mode the
// secondary button says "Skip" and means it.
export default function LocationDialog({
	open,
	onClose,
	assetId,
	assetName,
	locations,
	initialLocationId = null,
	initialDate,
	intro,
	skipLabel = "Cancel",
}: {
	open: boolean;
	onClose: () => void;
	assetId: number;
	assetName: string;
	// Active places only (the caller fetches the default list).
	locations: Location[];
	// Pre-selected place, e.g. the current one, or Teledyne after a factory
	// send-off. Only used if it is still in `locations`.
	initialLocationId?: number | null;
	// YYYY-MM-DD, defaults to today; never later than today.
	initialDate?: string;
	// Lead-in sentence; the default says the form is optional.
	intro?: string;
	skipLabel?: string;
}) {
	const router = useRouter();
	const [locationId, setLocationId] = useState<number | "">("");
	const [date, setDate] = useState(today());
	const [note, setNote] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [banner, setBanner] = useState<string | null>(null);

	// Re-seed each time it opens, so a second prompt never shows the last
	// one's leftovers.
	// biome-ignore lint/correctness/useExhaustiveDependencies: seed only when it opens, not when the caller's props change identity
	useEffect(() => {
		if (!open) return;
		const preselect = locations.some((l) => l.id === initialLocationId)
			? initialLocationId
			: null;
		setLocationId(preselect ?? "");
		const t = today();
		setDate(initialDate && initialDate < t ? initialDate : t);
		setNote("");
		setError(null);
	}, [open]);

	async function save() {
		if (locationId === "") {
			setError("Pick a place, or skip.");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			await recordAssetLocation(assetId, {
				locationId,
				effectiveDate: date || null,
				note: note.trim() || null,
			});
			onClose();
			setBanner("Location saved.");
			router.refresh();
		} catch (err) {
			// Kept in the dialog: the gateway's reason (e.g. a date before the
			// last recovery) tells the user exactly what to change.
			setError(err instanceof Error ? err.message : "Failed to save.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
				<DialogTitle>Location — {assetName}</DialogTitle>
				<DialogContent>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
						<Typography variant="body2" color="text.secondary">
							{intro ??
								"Optional. Skip it if it doesn't matter yet — you can set it when it reaches its next stop."}
						</Typography>

						{locations.length === 0 ? (
							<Alert severity="info">
								There are no places yet.{" "}
								<MuiLink component={Link} href="/locations">
									Add one on the Locations page.
								</MuiLink>
							</Alert>
						) : (
							<TextField
								select
								label="Place"
								size="small"
								value={locationId}
								onChange={(e) => setLocationId(Number(e.target.value))}
								fullWidth
							>
								{locations.map((place) => (
									<MenuItem key={place.id} value={place.id}>
										{place.name}
									</MenuItem>
								))}
							</TextField>
						)}

						<TextField
							label="Since"
							type="date"
							size="small"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							slotProps={{
								inputLabel: { shrink: true },
								htmlInput: { max: today() },
							}}
							helperText="The day it got there. Can't be in the future."
							fullWidth
						/>

						<TextField
							label="Note (optional)"
							size="small"
							value={note}
							onChange={(e) => setNote(e.target.value)}
							slotProps={{ htmlInput: { maxLength: 500 } }}
							fullWidth
						/>

						{error && <Alert severity="error">{error}</Alert>}
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={onClose} disabled={saving}>
						{skipLabel}
					</Button>
					<Button
						variant="contained"
						onClick={save}
						disabled={saving || locations.length === 0}
					>
						{saving ? "Saving…" : "Save"}
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
