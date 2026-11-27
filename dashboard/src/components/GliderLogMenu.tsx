"use client";

import AddServicingEventDialog, {
	DECOMMISSION,
	RETURN_TO_SERVICE,
} from "@/components/AddServicingEventDialog";
import LocationDialog from "@/components/LocationDialog";
import ResolveServicingDialog from "@/components/ResolveServicingDialog";
import { createWorkshop } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import EditNoteIcon from "@mui/icons-material/EditNote";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import type {
	AssetStatus,
	GliderLocationSource,
	Location,
	LookupOption,
	ServicingEvent,
	ServicingEventTypeOption,
} from "@ogdb/types";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";

// What "Start workshop" can do right now, worked out on the page from the
// glider's build (the same rules as the Build section's own button).
export type WorkshopAction =
	| { kind: "available" }
	// A workshop / scheduled build already exists: go and edit it.
	| { kind: "open"; missionId: number; label: string }
	| { kind: "blocked"; reason: string };

// An item opens the event dialog on a preset, the location dialog, the
// workshop, or an existing open event.
type Action =
	| {
			type: "event";
			eventType: string;
			title?: string;
			heading: string;
	  }
	| { type: "location" }
	| { type: "workshop" }
	| { type: "closeOpen" }
	// Take the "servicing required" flag off (the repair is done).
	| { type: "resolveFlag" }
	// Open an existing event for editing (used for a destroyed glider's
	// destroyed event, which is how a mistaken one is corrected).
	| { type: "editEvent"; event: ServicingEvent };

interface Item {
	key: string;
	label: string;
	// Why it can't be used right now. Shown under the label; the item is
	// greyed out. The gateway enforces the same rules -- this just saves a
	// round trip to an error.
	disabledReason?: string | null;
	action: Action;
}

interface Group {
	label: string;
	items: Item[];
}

// The glider "Log" menu: every thing you can record against a glider, in one
// place, grouped by what it is. Replaces the old "Add event" button.
//
// A glider's STATE is derived, never set -- each item here logs something
// that happened (an event, a workshop, a location, a lifecycle change) and
// the state follows. See docs/design/glider-state-and-location.md section 8.
export default function GliderLogMenu({
	gliderId,
	gliderName,
	status,
	statusSince,
	decommissionedDate,
	locationSource,
	locationId,
	servicingEvents,
	eventTypes,
	contacts,
	locations,
	workshop,
	openMission,
}: {
	gliderId: number;
	gliderName: string;
	status: AssetStatus | null;
	statusSince: string | null;
	decommissionedDate: string | null;
	locationSource: GliderLocationSource | null;
	locationId: number | null;
	servicingEvents: ServicingEvent[];
	eventTypes: ServicingEventTypeOption[];
	contacts: LookupOption[];
	// Active places only.
	locations: Location[];
	workshop: WorkshopAction;
	// The glider's open mission (if any), so destroyed / missing events can
	// offer to close it.
	openMission?: { id: number; label: string; status: string | null };
}) {
	const router = useRouter();
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const [dialog, setDialog] = useState<{
		eventType?: string;
		title?: string;
		heading?: string;
		editing: ServicingEvent | null;
	} | null>(null);
	// Config is kept after closing (only `open` flips) so the dialog doesn't
	// change shape while it fades out.
	const [dialogOpen, setDialogOpen] = useState(false);
	const [locationOpen, setLocationOpen] = useState(false);
	const [resolveOpen, setResolveOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// A destroyed event never has an end date, but it isn't an "open event" in
	// the sense of something to close -- it's terminal. Counting it here made
	// a destroyed glider look like it had an event waiting to be closed.
	// A "servicing required" flag is open-ended too, but it is a FLAG that
	// coexists with other events, not something to close before logging more.
	const openEvent =
		servicingEvents.find(
			(e) =>
				e.endDate === null &&
				e.eventType !== "destroyed" &&
				e.eventType !== "servicing_required",
		) ?? null;
	const openFlag =
		servicingEvents.find(
			(e) => e.eventType === "servicing_required" && e.endDate === null,
		) ?? null;
	const destroyedEvent =
		servicingEvents.find((e) => e.eventType === "destroyed") ?? null;
	const destroyed = status === "destroyed";
	const deployed = status === "deployed";
	const canSetLocation =
		locationSource === "recorded" || locationSource === "not_recorded";

	// Why an item that logs an event is unavailable, if it is. Missing and
	// Destroyed are the two things that can happen at sea, so they stay open
	// while deployed.
	function eventBlock(eventType: string): string | null {
		if (destroyed) {
			return `Destroyed${statusSince ? ` on ${formatDate(statusSince)}` : ""} — nothing can be logged after that.`;
		}
		if (eventType === "destroyed") return null;
		// A flag can be raised at any time (even while deployed or mid-event).
		if (eventType === "servicing_required") return null;
		if (eventType === "missing") {
			return openEvent ? "Close the open event first." : null;
		}
		if (deployed) return "Deployed — recover it first.";
		if (openEvent) return "Close the open event first.";
		return null;
	}

	const event = (
		key: string,
		label: string,
		eventType: string,
		heading: string,
		title?: string,
	): Item => ({
		key,
		label,
		disabledReason: eventBlock(eventType),
		action: { type: "event", eventType, title, heading },
	});

	const groups: Group[] = [];

	if (openEvent) {
		groups.push({
			label: "Open event",
			items: [
				{
					key: "close-open",
					label: `Close “${openEvent.title ?? openEvent.eventType}”…`,
					action: { type: "closeOpen" },
				},
			],
		});
	}

	// A destroyed glider can't be closed or added to, but the destroyed event
	// itself can be corrected: edit it, or delete it if it was a mistake --
	// which is also what lets the glider be returned to service.
	if (destroyedEvent) {
		groups.push({
			label: "Destroyed",
			items: [
				{
					key: "edit-destroyed",
					label: "Edit destroyed event…",
					action: { type: "editEvent", event: destroyedEvent },
				},
			],
		});
	}

	groups.push({
		label: "Movement",
		items: [
			event(
				"factory",
				"Send to Teledyne…",
				"factory_repair",
				"Send to Teledyne",
				"Factory repairs",
			),
			event("transit", "In transit…", "transit", "Log transit", "In transit"),
			event("loan", "On loan…", "on_loan", "Log loan", "On loan"),
			event(
				"field-test",
				"Field test…",
				"field_test",
				"Log field test",
				"Field test",
			),
			{
				key: "location",
				label: "Update location…",
				disabledReason: canSetLocation
					? null
					: deployed
						? "Deployed — it's at sea."
						: status === "missing"
							? "Missing — its location is unknown."
							: "Destroyed — it has no location.",
				action: { type: "location" },
			},
		],
	});

	groups.push({
		label: "Preparation",
		items: [
			{
				key: "workshop",
				label:
					workshop.kind === "open" ? `${workshop.label}…` : "Start workshop",
				disabledReason: destroyed
					? "Destroyed."
					: deployed
						? "Deployed — recover it first."
						: workshop.kind === "blocked"
							? workshop.reason
							: null,
				action: { type: "workshop" },
			},
			event("lab-service", "Lab service…", "servicing", "Log lab service"),
		],
	});

	// Condition: the do-not-deploy flag. Raising one opens the event dialog;
	// once it is open the item becomes "Resolve" instead (one open flag per
	// asset).
	groups.push({
		label: "Condition",
		items: [
			openFlag
				? {
						key: "resolve-flag",
						label: "Resolve servicing required…",
						disabledReason: null,
						action: { type: "resolveFlag" },
					}
				: event(
						"servicing-required",
						"Servicing required…",
						"servicing_required",
						"Servicing required",
					),
		],
	});

	groups.push({
		label: "Incidents",
		items: [
			event(
				"missing",
				"Went missing…",
				"missing",
				"Went missing",
				"Contact lost",
			),
			event("destroyed", "Destroyed…", "destroyed", "Log destruction"),
		],
	});

	groups.push({
		label: "Fleet",
		items: [
			decommissionedDate
				? {
						key: "return",
						label: "Return to service…",
						disabledReason: destroyed
							? "Destroyed — if that was a mistake, delete or edit the destroyed event above first."
							: null,
						action: {
							type: "event",
							eventType: RETURN_TO_SERVICE,
							heading: "Return to service",
						},
					}
				: {
						key: "decommission",
						label: "Decommission…",
						disabledReason: deployed
							? "Deployed — recover it first."
							: destroyed
								? "Already decommissioned by the destruction."
								: null,
						action: {
							type: "event",
							eventType: DECOMMISSION,
							heading: "Decommission",
						},
					},
		],
	});

	async function startWorkshop() {
		setBusy(true);
		try {
			const created = await createWorkshop(gliderId);
			router.push(`/missions/${created.id}`);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to start workshop.",
			);
			setBusy(false);
		}
	}

	function choose(item: Item) {
		setAnchor(null);
		const a = item.action;
		if (a.type === "event") {
			setDialog({
				eventType: a.eventType,
				title: a.title,
				heading: a.heading,
				editing: null,
			});
			setDialogOpen(true);
		} else if (a.type === "editEvent") {
			setDialog({ editing: a.event });
			setDialogOpen(true);
		} else if (a.type === "closeOpen") {
			setDialog({ editing: openEvent });
			setDialogOpen(true);
		} else if (a.type === "resolveFlag") {
			setResolveOpen(true);
		} else if (a.type === "location") {
			setLocationOpen(true);
		} else if (workshop.kind === "open") {
			router.push(`/missions/${workshop.missionId}`);
		} else {
			startWorkshop();
		}
	}

	return (
		<>
			<Button
				variant="contained"
				size="small"
				startIcon={<EditNoteIcon />}
				endIcon={<ArrowDropDownIcon />}
				onClick={(e) => setAnchor(e.currentTarget)}
				disabled={busy}
				sx={{ whiteSpace: "nowrap" }}
			>
				{busy ? "Working…" : "Log"}
			</Button>

			<Menu
				anchorEl={anchor}
				open={anchor !== null}
				onClose={() => setAnchor(null)}
				slotProps={{ paper: { sx: { minWidth: 280, maxWidth: 360 } } }}
			>
				{groups.map((group) => (
					<Fragment key={group.label}>
						<ListSubheader sx={{ lineHeight: "32px", bgcolor: "transparent" }}>
							{group.label}
						</ListSubheader>
						{group.items.map((item) => (
							<MenuItem
								key={item.key}
								disabled={!!item.disabledReason}
								onClick={() => choose(item)}
							>
								<ListItemText
									primary={item.label}
									secondary={item.disabledReason ?? undefined}
									slotProps={{
										secondary: { sx: { whiteSpace: "normal", fontSize: 11.5 } },
									}}
								/>
							</MenuItem>
						))}
					</Fragment>
				))}
			</Menu>

			<AddServicingEventDialog
				assetId={gliderId}
				open={dialogOpen}
				onClose={() => setDialogOpen(false)}
				eventTypes={eventTypes}
				contacts={contacts}
				initialEvent={dialog?.editing ?? null}
				lifecycle={{ decommissionedDate, name: gliderName }}
				presetEventType={dialog?.eventType}
				presetTitle={dialog?.title}
				dialogTitle={dialog?.heading}
				locations={locations}
				openMission={openMission}
			/>

			{openFlag && (
				<ResolveServicingDialog
					open={resolveOpen}
					onClose={() => setResolveOpen(false)}
					assetId={gliderId}
					eventId={openFlag.id}
					assetLabel={gliderName}
					title={openFlag.title}
					startDate={openFlag.startDate}
				/>
			)}

			<LocationDialog
				open={locationOpen}
				onClose={() => setLocationOpen(false)}
				assetId={gliderId}
				assetName={gliderName}
				locations={locations}
				initialLocationId={locationSource === "recorded" ? locationId : null}
			/>

			<Snackbar
				open={error !== null}
				onClose={() => setError(null)}
				anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
			>
				<Alert severity="error" variant="filled" onClose={() => setError(null)}>
					{error}
				</Alert>
			</Snackbar>
		</>
	);
}
