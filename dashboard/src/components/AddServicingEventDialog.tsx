"use client";

import { recordServicingEvent, updateServicingEvent } from "@/lib/api-client";
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
import type {
	LookupOption,
	ServicingEvent,
	ServicingEventTypeOption,
} from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const EVENT_TYPE_LABEL: Record<string, string> = {
	factory_repair: "Factory servicing",
	transit: "Transit",
	servicing: "Lab servicing (in-house)",
};

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function emptyState(defaultEventType: string) {
	return {
		eventType: defaultEventType,
		title: "",
		startDate: today(),
		endDate: "",
		performedByContactId: "" as number | "",
		details: "",
		attachment: null as File | null,
	};
}

function stateFromEvent(event: ServicingEvent) {
	return {
		eventType: event.eventType,
		title: event.title ?? "",
		startDate: event.startDate.slice(0, 10),
		endDate: event.endDate?.slice(0, 10) ?? "",
		performedByContactId: (event.performedByContactId ?? "") as number | "",
		details: event.details ?? "",
		attachment: null as File | null,
	};
}

// Always externally controlled: the Timeline tab owns whether this is
// adding a new event or closing/editing the asset's current open one
// (same event, same dialog, same one-open-event-per-asset rule --
// initialEvent just decides which HTTP verb this ends up as), and
// decides the trigger button's label accordingly.
export default function AddServicingEventDialog({
	assetId,
	open,
	onClose,
	eventTypes,
	contacts,
	initialEvent,
}: {
	assetId: number;
	open: boolean;
	onClose: () => void;
	eventTypes: ServicingEventTypeOption[];
	contacts: LookupOption[];
	initialEvent: ServicingEvent | null;
}) {
	const router = useRouter();
	const isEdit = initialEvent != null;

	const [state, setState] = useState(() =>
		emptyState(eventTypes[0]?.name ?? "servicing"),
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [banner, setBanner] = useState<{
		severity: "success" | "error";
		message: string;
	} | null>(null);

	// Re-seeds whenever the dialog opens (either fresh, or onto a
	// different/updated event to edit) -- keying on open+initialEvent?.id
	// avoids re-seeding mid-edit on unrelated parent re-renders.
	// biome-ignore lint/correctness/useExhaustiveDependencies: eventTypes/initialEvent object identity deliberately excluded
	useEffect(() => {
		if (!open) return;
		setState(
			initialEvent
				? stateFromEvent(initialEvent)
				: emptyState(eventTypes[0]?.name ?? "servicing"),
		);
		setError(null);
	}, [open, initialEvent?.id]);

	async function handleSave() {
		setError(null);
		if (!state.title.trim()) {
			setError("Give this event a short title.");
			return;
		}
		if (!state.startDate) {
			setError("Pick a start date.");
			return;
		}

		setSaving(true);
		try {
			const input = {
				eventType: state.eventType as ServicingEventTypeOption["name"],
				title: state.title.trim(),
				startDate: state.startDate,
				endDate: state.endDate || undefined,
				performedByContactId:
					state.performedByContactId === "" ? undefined : state.performedByContactId,
				details: state.details.trim() || undefined,
			};

			if (isEdit && initialEvent) {
				await updateServicingEvent(
					assetId,
					initialEvent.id,
					input,
					state.attachment ?? undefined,
				);
			} else {
				await recordServicingEvent(assetId, input, state.attachment ?? undefined);
			}
			onClose();
			setBanner({
				severity: "success",
				message: isEdit ? "Servicing event updated." : "Servicing event recorded.",
			});
		} catch (err) {
			setBanner({
				severity: "error",
				message:
					err instanceof Error ? err.message : "Failed to save servicing event.",
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
				<DialogTitle>
					{isEdit ? "Edit servicing event" : "Add servicing event"}
				</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 2 }}
				>
					{isEdit && initialEvent?.endDate === null && (
						<Alert severity="warning" sx={{ fontSize: 12.5 }}>
							This event is still open. Add an end date to close it before a
							new servicing event can be logged for this asset.
						</Alert>
					)}

					<TextField
						select
						size="small"
						label="Service event type"
						value={state.eventType}
						onChange={(e) =>
							setState((s) => ({ ...s, eventType: e.target.value }))
						}
					>
						{eventTypes.map((t) => (
							<MenuItem key={t.id} value={t.name}>
								{EVENT_TYPE_LABEL[t.name] ?? t.name}
							</MenuItem>
						))}
					</TextField>

					<Box sx={{ display: "flex", gap: 2 }}>
						<TextField
							size="small"
							label="Event title"
							placeholder="e.g. Pre-mission refurb"
							value={state.title}
							onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
							sx={{ flex: 1 }}
						/>
						<TextField
							select
							size="small"
							label="Person"
							value={state.performedByContactId}
							onChange={(e) =>
								setState((s) => ({
									...s,
									performedByContactId: e.target.value
										? Number(e.target.value)
										: "",
								}))
							}
							sx={{ flex: 1 }}
						>
							<MenuItem value="">—</MenuItem>
							{contacts.map((c) => (
								<MenuItem key={c.id} value={c.id}>
									{c.name}
								</MenuItem>
							))}
						</TextField>
					</Box>

					<Box sx={{ display: "flex", gap: 2 }}>
						<TextField
							size="small"
							type="date"
							label="Start date"
							value={state.startDate}
							onChange={(e) =>
								setState((s) => ({ ...s, startDate: e.target.value }))
							}
							InputLabelProps={{ shrink: true }}
							sx={{ flex: 1 }}
						/>
						<TextField
							size="small"
							type="date"
							label="End date"
							helperText="Leave blank while still in progress"
							value={state.endDate}
							onChange={(e) => setState((s) => ({ ...s, endDate: e.target.value }))}
							InputLabelProps={{ shrink: true }}
							sx={{ flex: 1 }}
						/>
					</Box>

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
						minRows={5}
						size="small"
						label="Servicing details"
						placeholder="What happened, who worked on it, parts replaced, follow-up needed..."
						value={state.details}
						onChange={(e) => {
							const value = e.target.value.slice(0, 5000);
							setState((s) => ({ ...s, details: value }));
						}}
						helperText={`${state.details.length} / 5000`}
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
