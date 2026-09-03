"use client";

import {
	decommissionAsset,
	recordServicingEvent,
	updateServicingEvent,
} from "@/lib/api-client";
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
	ServicingEventType,
	ServicingEventTypeOption,
} from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Synthetic "types" that aren't asset_service_events rows -- picking one
// swaps the form over to the fleet-lifecycle fields and saves via
// PATCH /assets/:id/decommission instead. See
// docs/design/derived-glider-status.md.
const DECOMMISSION = "__decommission__";
const RETURN_TO_SERVICE = "__return_to_service__";

const EVENT_TYPE_LABEL: Record<string, string> = {
	servicing: "Lab servicing (in-house)",
	factory_repair: "Factory servicing",
	transit: "Transit",
	on_loan: "On loan",
	field_test: "Field test",
	missing: "Went missing",
	destroyed: "Destroyed",
};

// destroyed also stamps the asset's retirement date (gateway side); the
// dialog just warns. missing is a normal span whose end date means
// "recovered on".
const TERMINAL_EVENT = "destroyed";

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
		eventType: event.eventType as string,
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
	lifecycle,
}: {
	assetId: number;
	open: boolean;
	onClose: () => void;
	eventTypes: ServicingEventTypeOption[];
	contacts: LookupOption[];
	initialEvent: ServicingEvent | null;
	// Gliders only -- unlocks the Decommission / Return to service options.
	lifecycle?: { decommissionedDate: string | null; name: string };
}) {
	const router = useRouter();
	const isEdit = initialEvent != null;

	const [state, setState] = useState(() => emptyState("servicing"));
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
			initialEvent ? stateFromEvent(initialEvent) : emptyState("servicing"),
		);
		setError(null);
	}, [open, initialEvent?.id]);

	const isDecommission = state.eventType === DECOMMISSION;
	const isReturn = state.eventType === RETURN_TO_SERVICE;
	const isTerminal = state.eventType === TERMINAL_EVENT;
	const isMissing = state.eventType === "missing";
	const isLifecycleAction = isDecommission || isReturn;

	async function handleSave() {
		setError(null);

		if (isReturn) {
			setSaving(true);
			try {
				await decommissionAsset(assetId, { decommissionedDate: null });
				onClose();
				setBanner({ severity: "success", message: "Returned to service." });
			} catch (err) {
				setBanner({
					severity: "error",
					message: err instanceof Error ? err.message : "Failed to save.",
				});
			} finally {
				setSaving(false);
			}
			return;
		}

		if (!state.startDate) {
			setError("Pick a date.");
			return;
		}

		if (isDecommission) {
			setSaving(true);
			try {
				await decommissionAsset(assetId, {
					decommissionedDate: state.startDate,
					reason: state.details.trim() || null,
				});
				onClose();
				setBanner({
					severity: "success",
					message: "Glider retired from fleet.",
				});
			} catch (err) {
				setBanner({
					severity: "error",
					message: err instanceof Error ? err.message : "Failed to save.",
				});
			} finally {
				setSaving(false);
			}
			return;
		}

		if (!state.title.trim()) {
			setError("Give this event a short title.");
			return;
		}

		setSaving(true);
		try {
			const input = {
				eventType: state.eventType as ServicingEventType,
				title: state.title.trim(),
				startDate: state.startDate,
				endDate: state.endDate || undefined,
				performedByContactId:
					state.performedByContactId === ""
						? undefined
						: state.performedByContactId,
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
				await recordServicingEvent(
					assetId,
					input,
					state.attachment ?? undefined,
				);
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

	const retired = lifecycle?.decommissionedDate ?? null;

	// Real event types, plus (gliders only, add mode only) one synthetic
	// fleet-lifecycle action.
	const typeOptions: { value: string; label: string }[] = [
		...eventTypes.map((t) => ({
			value: t.name,
			label: EVENT_TYPE_LABEL[t.name] ?? t.name,
		})),
	];
	if (lifecycle != null && !isEdit) {
		typeOptions.push(
			retired
				? { value: RETURN_TO_SERVICE, label: "Return to service" }
				: { value: DECOMMISSION, label: "Decommission — retire from fleet" },
		);
	}

	return (
		<>
			<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
				<DialogTitle>{isEdit ? "Edit event" : "Add event"}</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 2 }}
				>
					{isEdit && initialEvent?.endDate === null && (
						<Alert severity="warning" sx={{ fontSize: 12.5 }}>
							This event is still open. Add an end date to close it before a new
							event can be logged for this asset.
						</Alert>
					)}

					<TextField
						select
						size="small"
						label="Event type"
						value={state.eventType}
						onChange={(e) =>
							setState((s) => ({ ...s, eventType: e.target.value }))
						}
					>
						{typeOptions.map((o) => (
							<MenuItem key={o.value} value={o.value}>
								{o.label}
							</MenuItem>
						))}
					</TextField>

					{isReturn && (
						<Alert severity="info" sx={{ fontSize: 12.5 }}>
							Returns {lifecycle?.name ?? "this glider"} to the active fleet.
							Its status goes back to being derived from its timeline.
						</Alert>
					)}

					{isTerminal && (
						<Alert severity="warning" sx={{ fontSize: 12.5 }}>
							Logging this retires {lifecycle?.name ?? "the glider"} from the
							fleet as of the date below, and closes any open event. It can't be
							reopened — use “Return to service” if it was a mistake.
						</Alert>
					)}

					{isDecommission && (
						<Alert severity="warning" sx={{ fontSize: 12.5 }}>
							Removes {lifecycle?.name ?? "the glider"} from the active fleet.
							No timeline event is logged — use a “Went missing” or “Destroyed”
							event instead if something actually happened to it.
						</Alert>
					)}

					{!isLifecycleAction && (
						<Box sx={{ display: "flex", gap: 2 }}>
							<TextField
								size="small"
								label="Event title"
								placeholder="e.g. Pre-mission refurb"
								value={state.title}
								onChange={(e) =>
									setState((s) => ({ ...s, title: e.target.value }))
								}
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
					)}

					{!isReturn && (
						<Box sx={{ display: "flex", gap: 2 }}>
							<TextField
								size="small"
								type="date"
								label={
									isDecommission
										? "Retirement date"
										: isTerminal
											? "Date destroyed"
											: "Start date"
								}
								value={state.startDate}
								onChange={(e) =>
									setState((s) => ({ ...s, startDate: e.target.value }))
								}
								InputLabelProps={{ shrink: true }}
								sx={{ flex: 1 }}
							/>
							{!isLifecycleAction && !isTerminal && (
								<TextField
									size="small"
									type="date"
									label={isMissing ? "Recovered on" : "End date"}
									helperText={
										isMissing
											? "Leave blank while still missing"
											: "Leave blank while still in progress"
									}
									value={state.endDate}
									onChange={(e) =>
										setState((s) => ({ ...s, endDate: e.target.value }))
									}
									InputLabelProps={{ shrink: true }}
									sx={{ flex: 1 }}
								/>
							)}
						</Box>
					)}

					{!isLifecycleAction && (
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
										onClick={() =>
											setState((s) => ({ ...s, attachment: null }))
										}
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
					)}

					{!isReturn && (
						<TextField
							multiline
							minRows={isLifecycleAction || isTerminal ? 2 : 5}
							size="small"
							label={
								isDecommission
									? "Reason"
									: isTerminal
										? "What happened"
										: "Details"
							}
							placeholder={
								isDecommission
									? "e.g. end of life, sold, transferred"
									: isTerminal
										? "e.g. run over by a fishing vessel off Svinøy"
										: "What happened, who worked on it, parts replaced, follow-up needed..."
							}
							value={state.details}
							onChange={(e) => {
								const value = e.target.value.slice(0, 5000);
								setState((s) => ({ ...s, details: value }));
							}}
							helperText={`${state.details.length} / 5000`}
							FormHelperTextProps={{ sx: { textAlign: "right", mr: 0 } }}
						/>
					)}

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
					<Button
						variant="contained"
						color={isTerminal || isDecommission ? "error" : "primary"}
						onClick={handleSave}
						disabled={saving}
					>
						{saving ? (
							<CircularProgress size={16} sx={{ color: "inherit" }} />
						) : isReturn ? (
							"Return to service"
						) : isDecommission ? (
							"Retire glider"
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
