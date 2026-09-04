"use client";

import { recordRmaEvent, updateRmaEvent } from "@/lib/api-client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { LookupOption, RmaEvent, RmaEventType } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// No DB-backed lookup for this -- rma_events.event_type is a CHECK
// constraint, not a table, so the option list is just this map.
const EVENT_TYPE_LABEL: Record<RmaEventType, string> = {
	opened: "Opened",
	shipped_out: "Shipped out",
	received_by_repairer: "Received by repairer",
	status_update: "Status update",
	escalated_to_manufacturer: "Escalated to manufacturer",
	shipping_issue: "Shipping issue",
	received_by_manufacturer: "Received by manufacturer",
	returned: "Returned",
	closed: "Closed",
};

const EVENT_TYPE_OPTIONS = Object.keys(EVENT_TYPE_LABEL) as RmaEventType[];

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function emptyState() {
	return {
		eventType: "status_update" as RmaEventType,
		eventDate: today(),
		facilityId: "" as number | "",
		referenceNumber: "",
		notes: "",
		attachment: null as File | null,
	};
}

function stateFromEvent(event: RmaEvent) {
	return {
		eventType: event.eventType,
		eventDate: event.eventDate.slice(0, 10),
		facilityId: (event.facilityId ?? "") as number | "",
		referenceNumber: event.referenceNumber ?? "",
		notes: event.notes ?? "",
		attachment: null as File | null,
	};
}

// Always externally controlled, same convention as
// AddServicingEventDialog -- the RMA detail page owns whether this is
// adding a new step or editing an existing one (initialEvent decides
// the HTTP verb), and decides the trigger button's label accordingly.
export default function AddRmaEventDialog({
	rmaId,
	open,
	onClose,
	manufacturers,
	initialEvent,
}: {
	rmaId: number;
	open: boolean;
	onClose: () => void;
	manufacturers: LookupOption[];
	initialEvent: RmaEvent | null;
}) {
	const router = useRouter();
	const isEdit = initialEvent != null;

	const [state, setState] = useState(() => emptyState());
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [banner, setBanner] = useState<{
		severity: "success" | "error";
		message: string;
	} | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: initialEvent object identity deliberately excluded
	useEffect(() => {
		if (!open) return;
		setState(initialEvent ? stateFromEvent(initialEvent) : emptyState());
		setError(null);
	}, [open, initialEvent?.id]);

	async function handleSave() {
		setError(null);
		if (!state.eventDate) {
			setError("Pick a date.");
			return;
		}

		setSaving(true);
		try {
			const input = {
				eventType: state.eventType,
				eventDate: state.eventDate,
				facilityId: state.facilityId === "" ? undefined : state.facilityId,
				referenceNumber: state.referenceNumber.trim() || undefined,
				notes: state.notes.trim() || undefined,
			};

			if (isEdit && initialEvent) {
				await updateRmaEvent(
					rmaId,
					initialEvent.id,
					input,
					state.attachment ?? undefined,
				);
			} else {
				await recordRmaEvent(rmaId, input, state.attachment ?? undefined);
			}
			onClose();
			setBanner({
				severity: "success",
				message: isEdit ? "Event updated." : "Event recorded.",
			});
		} catch (err) {
			setBanner({
				severity: "error",
				message: err instanceof Error ? err.message : "Failed to save event.",
			});
		} finally {
			setSaving(false);
		}
	}

	function dismissBanner() {
		setBanner(null);
		router.refresh();
	}

	return (
		<>
			<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
				<DialogTitle>{isEdit ? "Edit event" : "Add event"}</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 2 }}
				>
					<TextField
						select
						size="small"
						label="Event type"
						value={state.eventType}
						onChange={(e) =>
							setState((s) => ({
								...s,
								eventType: e.target.value as RmaEventType,
							}))
						}
					>
						{EVENT_TYPE_OPTIONS.map((t) => (
							<MenuItem key={t} value={t}>
								{EVENT_TYPE_LABEL[t]}
							</MenuItem>
						))}
					</TextField>

					<Box sx={{ display: "flex", gap: 2 }}>
						<TextField
							size="small"
							type="date"
							label="Date"
							value={state.eventDate}
							onChange={(e) =>
								setState((s) => ({ ...s, eventDate: e.target.value }))
							}
							InputLabelProps={{ shrink: true }}
							sx={{ flex: 1 }}
						/>
						<TextField
							select
							size="small"
							label="Current facility"
							value={state.facilityId}
							onChange={(e) =>
								setState((s) => ({
									...s,
									facilityId: e.target.value ? Number(e.target.value) : "",
								}))
							}
							sx={{ flex: 1 }}
						>
							<MenuItem value="">—</MenuItem>
							{manufacturers.map((m) => (
								<MenuItem key={m.id} value={m.id}>
									{m.name}
								</MenuItem>
							))}
						</TextField>
					</Box>

					<TextField
						size="small"
						label="Reference number"
						placeholder="Tracking #, AWB #, whatever fits this step"
						value={state.referenceNumber}
						onChange={(e) =>
							setState((s) => ({ ...s, referenceNumber: e.target.value }))
						}
					/>

					<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
						<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
							<Button component="label" size="small">
								Attach document (PDF)
								<input
									type="file"
									accept="application/pdf"
									hidden
									onChange={(e) =>
										setState((s) => ({
											...s,
											attachment: e.target.files?.[0] ?? null,
										}))
									}
								/>
							</Button>
							{state.attachment && (
								<Button
									size="small"
									onClick={() => setState((s) => ({ ...s, attachment: null }))}
								>
									Remove
								</Button>
							)}
						</Box>
						{state.attachment && (
							<Typography variant="caption" color="text.secondary">
								{state.attachment.name}
							</Typography>
						)}
						{isEdit && initialEvent?.documentId && !state.attachment && (
							<Typography variant="caption" color="text.disabled">
								Has an attachment on file. Attaching a new one adds it as the
								latest.
							</Typography>
						)}
					</Box>

					<TextField
						multiline
						minRows={3}
						size="small"
						label="Notes"
						placeholder="What happened at this step..."
						value={state.notes}
						onChange={(e) => {
							const value = e.target.value.slice(0, 5000);
							setState((s) => ({ ...s, notes: value }));
						}}
						helperText={`${state.notes.length} / 5000`}
						FormHelperTextProps={{ sx: { textAlign: "right", mr: 0 } }}
					/>

					{error && (
						<Typography color="error" variant="body2">
							{error}
						</Typography>
					)}
				</DialogContent>
				<DialogActions sx={{ px: 3, py: 1.5 }}>
					<Button onClick={onClose} disabled={saving}>
						Cancel
					</Button>
					<Button variant="contained" onClick={handleSave} disabled={saving}>
						{saving ? (
							<CircularProgress size={16} sx={{ color: "inherit" }} />
						) : isEdit ? (
							"Save changes"
						) : (
							"Save event"
						)}
					</Button>
				</DialogActions>
			</Dialog>

			<Snackbar
				open={banner !== null}
				onClose={dismissBanner}
				anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
			>
				<Alert
					severity={banner?.severity}
					variant="filled"
					sx={{ maxWidth: 480 }}
					action={
						<Button color="inherit" size="small" onClick={dismissBanner}>
							OK
						</Button>
					}
				>
					{banner?.message}
				</Alert>
			</Snackbar>
		</>
	);
}
