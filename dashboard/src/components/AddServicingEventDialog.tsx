"use client";

import LocationDialog from "@/components/LocationDialog";
import {
	decommissionAsset,
	deleteServicingEvent,
	getGliderBuildClient,
	recordServicingEvent,
	updateServicingEvent,
} from "@/lib/api-client";
import { formatAssetType } from "@/lib/format";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type {
	GliderBuildComponent,
	Location,
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
// Exported so the glider Log menu can open the dialog straight onto one.
export const DECOMMISSION = "__decommission__";
export const RETURN_TO_SERVICE = "__return_to_service__";

// Labels shown in this dialog's own Event type dropdown -- distinct from
// KIND_META's labels (lib/timeline.ts), which drive the timeline chart's
// chips/cards elsewhere and are left as-is here on purpose (e.g.
// "Factory servicing" there vs. "Factory service" here) since only this
// dropdown was asked to be reorganized.
const EVENT_TYPE_LABEL: Record<string, string> = {
	servicing: "Lab service",
	factory_repair: "Factory service",
	transit: "Transit",
	on_loan: "On loan",
	field_test: "Field test",
	missing: "Went missing",
	destroyed: "Destroyed",
	// Glider modal only -- filtered out of typeOptions below when
	// `lifecycle` is absent (a bare, non-glider asset).
	pre_mission_servicing: "Pre-mission lab service",
};

const PRE_MISSION_SERVICING = "pre_mission_servicing";

// Suggested titles for a Lab service event. The title box stays a free-text
// field (freeSolo), so anything else can still be typed in.
const LAB_SERVICE_TITLE_OPTIONS = [
	"Pre mission service",
	"Post mission service",
];

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
	presetEventType,
	presetTitle,
	dialogTitle,
	locations,
	openMission,
}: {
	assetId: number;
	open: boolean;
	onClose: () => void;
	eventTypes: ServicingEventTypeOption[];
	contacts: LookupOption[];
	initialEvent: ServicingEvent | null;
	// Gliders only -- unlocks the Decommission / Return to service options.
	lifecycle?: { decommissionedDate: string | null; name: string };
	// Opened from the glider Log menu: start on this event type (a real
	// service-event name, or DECOMMISSION / RETURN_TO_SERVICE) and hide the
	// type picker -- the menu item already said what this is. Ignored when
	// editing an existing event.
	presetEventType?: string;
	// Suggested title for a new event, and a heading to match the menu item.
	presetTitle?: string;
	dialogTitle?: string;
	// Gliders only -- the active places. When given, closing an event (it's
	// back) or sending the glider to the factory offers a skippable
	// "Where is it now?" prompt after saving.
	locations?: Location[];
	// Gliders only -- the glider's open mission, if it has one. Destroyed /
	// missing events then offer to close it too (a mission's status is stored,
	// so it would otherwise stay "active" under a destroyed glider).
	openMission?: { id: number; label: string; status: string | null };
}) {
	const router = useRouter();
	const isEdit = initialEvent != null;
	const lockedType = presetEventType != null && !isEdit;
	// Both default on each time the dialog opens; the user can untick either.
	const [closeMission, setCloseMission] = useState(true);
	const [setMissionEndDate, setSetMissionEndDate] = useState(true);

	const [state, setState] = useState(() => emptyState("servicing"));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [banner, setBanner] = useState<{
		severity: "success" | "error";
		message: string;
	} | null>(null);

	// The glider's currently attached components, offered as a "retire
	// these too" checklist once "Retired" is picked -- all checked by
	// default, opt out per row (e.g. keep a science sensor in service for
	// reuse elsewhere). Fetched lazily rather than on every dialog open,
	// since most Add-event visits never touch decommission at all.
	const [buildComponents, setBuildComponents] = useState<
		GliderBuildComponent[]
	>([]);
	const [buildLoading, setBuildLoading] = useState(false);
	const [excludedChildIds, setExcludedChildIds] = useState<Set<number>>(
		new Set(),
	);

	// Re-seeds whenever the dialog opens (either fresh, or onto a
	// different/updated event to edit) -- keying on open+initialEvent?.id
	// avoids re-seeding mid-edit on unrelated parent re-renders.
	// biome-ignore lint/correctness/useExhaustiveDependencies: eventTypes/initialEvent object identity deliberately excluded
	useEffect(() => {
		if (!open) return;
		setState(
			initialEvent
				? stateFromEvent(initialEvent)
				: {
						...emptyState(presetEventType ?? "servicing"),
						title: presetTitle ?? "",
					},
		);
		setError(null);
		setCloseMission(true);
		setSetMissionEndDate(true);
	}, [open, initialEvent?.id, presetEventType]);

	// Deleting an event logged by mistake (edit mode only).
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [deleting, setDeleting] = useState(false);

	// The skippable "Where is it now?" prompt shown after a save that makes
	// the location worth asking about. Never required.
	const [locationPrompt, setLocationPrompt] = useState<{
		intro: string;
		locationId: number | null;
		date: string;
	} | null>(null);

	const isDecommission = state.eventType === DECOMMISSION;
	const isReturn = state.eventType === RETURN_TO_SERVICE;
	const isTerminal = state.eventType === TERMINAL_EVENT;
	const isMissing = state.eventType === "missing";
	const isLifecycleAction = isDecommission || isReturn;
	// Offer to close the open mission when logging the glider's destruction or
	// loss. A missing-in-action mission can still be closed out by a later
	// destruction, but a glider can only GO missing from an active one.
	const canCloseMission =
		!isEdit &&
		!!lifecycle &&
		!!openMission &&
		(isTerminal || (isMissing && openMission.status === "active"));
	const closingMission = canCloseMission && closeMission;

	useEffect(() => {
		if (!isDecommission) return;
		let cancelled = false;
		setBuildLoading(true);
		getGliderBuildClient(assetId)
			.then((build) => {
				if (cancelled) return;
				setBuildComponents(build.components);
				setExcludedChildIds(new Set());
			})
			.catch(() => {
				if (!cancelled) setBuildComponents([]);
			})
			.finally(() => {
				if (!cancelled) setBuildLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [isDecommission, assetId]);

	// Everything downstream of an asset in the build tree (by
	// parentAssetId, e.g. a CT sensor nested under a payload bay) --
	// toggling a component carries its whole subtree with it, so you
	// can't end up retiring a sensor "with the glider" while the payload
	// bay that physically holds it is being freed up for reuse.
	function descendantIds(rootId: number): number[] {
		const childrenOf = new Map<number, number[]>();
		for (const c of buildComponents) {
			if (c.parentAssetId == null) continue;
			const list = childrenOf.get(c.parentAssetId) ?? [];
			list.push(c.assetId);
			childrenOf.set(c.parentAssetId, list);
		}
		const result: number[] = [];
		const stack = [rootId];
		while (stack.length) {
			const current = stack.pop();
			for (const child of childrenOf.get(current as number) ?? []) {
				result.push(child);
				stack.push(child);
			}
		}
		return result;
	}

	function toggleChild(childAssetId: number) {
		setExcludedChildIds((prev) => {
			const next = new Set(prev);
			const excluding = !next.has(childAssetId);
			for (const id of [childAssetId, ...descendantIds(childAssetId)]) {
				if (excluding) next.add(id);
				else next.delete(id);
			}
			return next;
		});
	}

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
			// Checked = retires with the glider (decommissioned). Everything
			// else in its latest build is left alone, free to be reused --
			// see DecommissionInput.childAssetIds. Always sent as an array (even
			// empty), never omitted, so the gateway knows a build tree was
			// actually reviewed here.
			const retiredWithGlider = buildComponents
				.map((c) => c.assetId)
				.filter((componentId) => !excludedChildIds.has(componentId));
			const freedUp = buildComponents.filter((c) =>
				excludedChildIds.has(c.assetId),
			).length;
			setSaving(true);
			try {
				await decommissionAsset(assetId, {
					decommissionedDate: state.startDate,
					reason: state.details.trim() || null,
					childAssetIds: retiredWithGlider,
				});
				onClose();
				const parts: string[] = [];
				if (retiredWithGlider.length)
					parts.push(
						`${retiredWithGlider.length} component${retiredWithGlider.length === 1 ? "" : "s"} decommissioned with it`,
					);
				if (freedUp) parts.push(`${freedUp} freed up for reuse`);
				setBanner({
					severity: "success",
					message: parts.length
						? `Glider decommissioned — ${parts.join(", ")}.`
						: "Glider decommissioned.",
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
		if (state.endDate && state.endDate < state.startDate) {
			setError("End date can't be before the start date.");
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
				closeMissionId:
					closingMission && openMission ? openMission.id : undefined,
				closeMissionSetEndDate:
					closingMission && isTerminal ? setMissionEndDate : undefined,
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
			// Gliders only: ask (skippably) where it is when that is now a real
			// question -- an open event was just closed (it's back), or it was
			// just sent to the factory. Anything else leaves location alone.
			if (lifecycle && locations && state.eventType !== TERMINAL_EVENT) {
				const localToday = new Date().toLocaleDateString("en-CA");
				if (
					isEdit &&
					initialEvent &&
					initialEvent.endDate === null &&
					// Correcting a mistaken destroyed event isn't "it's back".
					initialEvent.eventType !== TERMINAL_EVENT &&
					input.endDate
				) {
					const was =
						initialEvent.eventType === "missing"
							? "It's been found."
							: `Back from ${(EVENT_TYPE_LABEL[initialEvent.eventType] ?? "its event").toLowerCase()}.`;
					setLocationPrompt({
						intro: `${was} Where is ${lifecycle.name} now? Skip it if it doesn't matter yet.`,
						locationId: null,
						date: input.endDate < localToday ? input.endDate : localToday,
					});
				} else if (
					!isEdit &&
					input.eventType === "factory_repair" &&
					!input.endDate
				) {
					setLocationPrompt({
						intro: `Sent to the factory. Record where ${lifecycle.name} is? Skip it if you'd rather wait.`,
						locationId:
							locations.find((l) => /teledyne/i.test(l.name))?.id ?? null,
						date: input.startDate < localToday ? input.startDate : localToday,
					});
				}
			}
			onClose();
			setBanner({
				severity: "success",
				message: isEdit
					? "Event updated."
					: closingMission && openMission
						? `Event recorded. ${openMission.label} marked ${isTerminal ? "killed in action" : "missing in action"}.`
						: "Event recorded.",
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

	async function handleDelete() {
		if (!initialEvent) return;
		setDeleting(true);
		try {
			const result = await deleteServicingEvent(assetId, initialEvent.id);
			setConfirmDelete(false);
			onClose();
			setBanner({
				severity: "success",
				message: result.returnedToService
					? `Event deleted. ${lifecycle?.name ?? "The glider"} is back in service.`
					: "Event deleted.",
			});
		} catch (err) {
			setConfirmDelete(false);
			setBanner({
				severity: "error",
				message: err instanceof Error ? err.message : "Failed to delete event.",
			});
		} finally {
			setDeleting(false);
		}
	}

	function dismissBanner() {
		setBanner(null);
		router.refresh();
	}

	const retired = lifecycle?.decommissionedDate ?? null;

	// Real event types (pre_mission_servicing filtered to gliders only),
	// plus (gliders only, add mode only) one synthetic fleet-lifecycle
	// action -- all sorted together alphabetically by label so the two
	// asset-page/glider-page dialogs read as one consistent, organized
	// list rather than "real types, then a special one tacked on at the
	// end".
	const typeOptions: { value: string; label: string }[] = eventTypes
		.filter((t) => t.name !== PRE_MISSION_SERVICING || lifecycle != null)
		.map((t) => ({
			value: t.name,
			label: EVENT_TYPE_LABEL[t.name] ?? t.name,
		}));
	if (lifecycle != null && !isEdit) {
		typeOptions.push(
			retired
				? { value: RETURN_TO_SERVICE, label: "Return to service" }
				: { value: DECOMMISSION, label: "Decommission" },
		);
	}
	typeOptions.sort((a, b) => a.label.localeCompare(b.label));

	return (
		<>
			<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
				<DialogTitle>
					{isEdit ? "Edit event" : (dialogTitle ?? "Add event")}
				</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 2 }}
				>
					{isEdit && initialEvent?.endDate === null && !isTerminal && (
						<Alert severity="warning" sx={{ fontSize: 12.5 }}>
							This event is still open. Add an end date to close it before a new
							event can be logged for this asset.
						</Alert>
					)}

					{isEdit && isTerminal && (
						<Alert severity="info" sx={{ fontSize: 12.5 }}>
							Destroyed events don't have an end date and never need to be
							closed. Nothing can be logged after this date; an earlier event
							can still be added if it has an end date on or before it. If this
							was logged by mistake, delete it (button below) — or change its
							type here. Either lets the glider be returned to service.
						</Alert>
					)}

					{!lockedType && (
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
					)}

					{isReturn && (
						<Alert severity="info" sx={{ fontSize: 12.5 }}>
							Returns {lifecycle?.name ?? "this glider"} to the active fleet.
							Its status goes back to being derived from its timeline.
						</Alert>
					)}

					{isTerminal && !isEdit && (
						<Alert severity="warning" sx={{ fontSize: 12.5 }}>
							Logging this decommissions {lifecycle?.name ?? "the glider"} from
							the fleet as of the date below, and closes any open event. It
							can't be reopened — use “Return to service” if it was a mistake.
						</Alert>
					)}

					{canCloseMission && openMission && (
						<Box
							sx={{
								border: 1,
								borderColor: "divider",
								borderRadius: 1,
								px: 1.5,
								py: 0.5,
							}}
						>
							<FormControlLabel
								control={
									<Checkbox
										size="small"
										checked={closeMission}
										onChange={(e) => setCloseMission(e.target.checked)}
									/>
								}
								label={`Also close ${openMission.label}`}
							/>
							<Typography
								variant="caption"
								color="text.secondary"
								display="block"
								sx={{ ml: 4, mt: -0.5, pb: 0.5 }}
							>
								{isTerminal
									? "Its status becomes “killed in action”, so it stops showing as active."
									: "Its status becomes “missing in action”; its end date stays empty."}
							</Typography>
							{isTerminal && closeMission && (
								<>
									<FormControlLabel
										control={
											<Checkbox
												size="small"
												checked={setMissionEndDate}
												onChange={(e) => setSetMissionEndDate(e.target.checked)}
											/>
										}
										label={`Set its end date to ${state.startDate || "the date below"}`}
									/>
									<Typography
										variant="caption"
										color="text.secondary"
										display="block"
										sx={{ ml: 4, mt: -0.5, pb: 0.5 }}
									>
										Untick if it was lost at sea and never recovered.
									</Typography>
								</>
							)}
						</Box>
					)}

					{isDecommission && (
						<Alert severity="warning" sx={{ fontSize: 12.5 }}>
							Removes {lifecycle?.name ?? "the glider"} from the active fleet.
							No timeline event is logged — use a “Went missing” or “Destroyed”
							event instead if something actually happened to it.
						</Alert>
					)}

					{isDecommission && buildLoading && (
						<Typography variant="body2" color="text.disabled">
							Loading last flown build…
						</Typography>
					)}

					{isDecommission && !buildLoading && buildComponents.length > 0 && (
						<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
							<Box
								sx={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
								}}
							>
								<Typography variant="body2" color="text.secondary">
									Components in its last flown build — checked ones are
									decommissioned with the glider; unchecked ones stay in
									service, free for reuse elsewhere:
								</Typography>
								<Button
									size="small"
									onClick={() =>
										setExcludedChildIds((prev) =>
											prev.size === 0
												? new Set(buildComponents.map((c) => c.assetId))
												: new Set(),
										)
									}
								>
									{excludedChildIds.size === 0
										? "Free up all instead"
										: "Decommission all instead"}
								</Button>
							</Box>
							<Box
								sx={{
									border: "1px solid",
									borderColor: "divider",
									borderRadius: 1,
									maxHeight: 220,
									overflowY: "auto",
								}}
							>
								{buildComponents.map((c) => {
									const excluded = excludedChildIds.has(c.assetId);
									return (
										<Box
											key={c.assetId}
											sx={{
												display: "flex",
												alignItems: "center",
												gap: 1,
												pl: (c.depth - 1) * 2,
												pr: 1,
											}}
										>
											<Checkbox
												size="small"
												checked={!excluded}
												onChange={() => toggleChild(c.assetId)}
											/>
											<Typography variant="body2" sx={{ fontSize: 13 }}>
												{formatAssetType(c.assetType)}
												{c.serialNumber ? ` · SN ${c.serialNumber}` : ""}
												{c.position
													? ` (${c.positionLabel ?? c.position})`
													: ""}
											</Typography>
											{excluded && (
												<Typography
													variant="caption"
													color="text.secondary"
													sx={{ fontStyle: "italic" }}
												>
													freed for reuse
												</Typography>
											)}
										</Box>
									);
								})}
							</Box>
						</Box>
					)}

					{!isLifecycleAction && (
						<Box sx={{ display: "flex", gap: 2 }}>
							<Autocomplete
								freeSolo
								size="small"
								options={
									state.eventType === "servicing"
										? LAB_SERVICE_TITLE_OPTIONS
										: []
								}
								inputValue={state.title}
								onInputChange={(_e, value) =>
									setState((s) => ({ ...s, title: value }))
								}
								sx={{ flex: 1 }}
								renderInput={(params) => (
									<TextField
										{...params}
										label="Event title"
										placeholder="e.g. Pre-mission refurb"
									/>
								)}
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
										? "Decommission date"
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
					{isEdit && initialEvent && (
						<Button
							color="error"
							onClick={() => setConfirmDelete(true)}
							disabled={saving || deleting}
							sx={{ mr: "auto" }}
						>
							Delete event
						</Button>
					)}
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
							"Decommission glider"
						) : isEdit ? (
							"Save changes"
						) : (
							"Save event"
						)}
					</Button>
				</DialogActions>
			</Dialog>

			<Dialog
				open={confirmDelete}
				onClose={() => !deleting && setConfirmDelete(false)}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle>Delete this event?</DialogTitle>
				<DialogContent>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
						<Typography variant="body2">
							<strong>
								{initialEvent
									? (EVENT_TYPE_LABEL[initialEvent.eventType] ??
										initialEvent.eventType)
									: ""}
							</strong>
							{initialEvent?.title ? ` — ${initialEvent.title}` : ""}
							{initialEvent ? ` (${initialEvent.startDate.slice(0, 10)})` : ""}
						</Typography>
						<Typography variant="body2" color="text.secondary">
							Use this for an event that should never have been logged. It is
							removed from the timeline for good; the change log keeps a record
							that it existed. To fix a wrong date or type, edit it instead.
						</Typography>
						{initialEvent?.eventType === TERMINAL_EVENT && (
							<Alert severity="warning" sx={{ fontSize: 12.5 }}>
								This event decommissioned {lifecycle?.name ?? "the glider"}.
								Deleting it removes that decommission too, so it returns to the
								fleet. Any event it closed stays closed, and so does a mission
								it closed — reopen that on the mission page if needed.
							</Alert>
						)}
						{initialEvent?.documentId && (
							<Alert severity="warning" sx={{ fontSize: 12.5 }}>
								Its attached file is deleted too.
							</Alert>
						)}
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setConfirmDelete(false)} disabled={deleting}>
						Keep it
					</Button>
					<Button
						color="error"
						variant="contained"
						onClick={handleDelete}
						disabled={deleting}
					>
						{deleting ? "Deleting…" : "Delete event"}
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

			{lifecycle && locations && (
				<LocationDialog
					open={locationPrompt !== null}
					onClose={() => {
						setLocationPrompt(null);
						router.refresh();
					}}
					assetId={assetId}
					assetName={lifecycle.name}
					locations={locations}
					initialLocationId={locationPrompt?.locationId ?? null}
					initialDate={locationPrompt?.date}
					intro={locationPrompt?.intro}
					skipLabel="Skip"
				/>
			)}
		</>
	);
}
