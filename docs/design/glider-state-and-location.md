# Glider state, location and lifecycle — plan

**Status (2026-11-25):** OGDB migrations written and applied to `ogdb-test`
(`xxxx_asset_locations`, `xxxx_glider_state_and_location_views`; round-trip
tested, not on prod). Portal changes not started. Extends and partly replaces
`derived-glider-status.md` (see "What this changes" below). Builds on
`mission-builds.md` (workshop / scheduled / active / recovered) and the
refurbishment logsheet (`refurbishments.cleared_at`).

Spans two repos:

- **`~/projects/OGDB`** — schema: location tables, the extended derived view,
  new status seed rows.
- **`~/projects/OGDB-portal`** (this repo) — gateway write paths, shared
  types, the glider header, the "Log" menu, fleet table, timeline markers.

---

## 1. Why

The glider page shows a status chip and a "Retired" chip, and neither can be
edited. That is deliberate: the chip is *derived* from the timeline. But the
current derivation has gaps that showed up with SG561 (destroyed 2026-03-06 by
a ship strike on recovery):

- SG561 reads **Lab** + **Retired**. Nothing is wrong with the derivation —
  its timeline simply has no `destroyed` event, so it falls through to the
  default, **Lab**. "Lab" is doing two jobs: *where it is* and *"nothing else
  is known"*.
- There is no way to say "this glider is in the lab and being prepared" or
  "in the lab and cleared to deploy". Both read "Lab".
- "Scheduled" (a mission is assigned) is a fact about the mission plan, not a
  state: a scheduled glider can still be in the workshop.
- Location after recovery is often not worth recording straight away. The
  model must allow "not recorded" without treating it as an error.

---

## 2. The model: four independent pieces

| Piece | Question it answers | Values | Set by | Shown as |
|---|---|---|---|---|
| **State** | What is it doing / ready for? | Deployed, In service, Ready to deploy, Workshop, Idle, Missing, Destroyed | **derived** — never typed | main chip |
| **Location** | Where is it? | a place from `locations`, or At sea / Unknown / none | **recorded** (optional) or derived from state | text under the chip |
| **Scheduled** | Does it have a mission assigned? | yes (mission + planned date) / no | **derived** from missions | small tag |
| **Decommissioned** | Is it still part of the fleet? | date + reason, or nothing | recorded (deliberate action) | small tag, only when set |

They combine freely:

| Example | State | Location | Scheduled | Decommissioned |
|---|---|---|---|---|
| Being prepared for a mission already assigned | Workshop | Lab | GL_xxx | — |
| Signed off, waiting for the ship | Ready to deploy | Lab | GL_xxx | — |
| Out on a mission | Deployed | At sea | — | — |
| Just recovered, nobody updated it | Idle | *not recorded* | — | — |
| GNÅ: old, still physically here | Idle | Lab | — | yes |
| SG562: lost | Missing | Unknown | — | yes |
| SG561: destroyed | Destroyed | — | — | yes |

There is no "Active" chip. Absence of the Decommissioned tag already means "in
the fleet", and "deployed" is a State.

### Why derive State instead of storing it

A stored status can contradict the facts it summarises (the original
problem: "Deployed" with no open mission). A derived one cannot. Location is
different: nothing else records where a glider *is* after recovery, so it has
to be recorded — but it is optional, and a rule (§5) stops it going stale.

---

## 3. State rules

First match wins:

| # | Condition | State |
|---|---|---|
| 1 | a `destroyed` service event exists | **Destroyed** |
| 2 | an open `missing` event | **Missing** |
| 3 | an open mission (`deployment_date <= today`, `retrieval_date IS NULL`) | **Deployed** |
| 4 | an open `servicing` / `factory_repair` / `transit` / `on_loan` / `field_test` event | **In service** (sub-label from the event type) |
| 5 | an open workshop/scheduled build whose logsheet is cleared | **Ready to deploy** |
| 6 | an open workshop build | **Workshop** |
| 7 | otherwise | **Idle** |

As built: `missing` now beats `deployed` (a glider lost mid-mission is
Missing). "Open build" means a mission with status `workshop`, or a
`scheduled` one whose logsheet is cleared. A scheduled mission with an
uncleared logsheet adds nothing to State (it still sets the Scheduled tag).
When several open service events exist, the newest wins.

`Idle` replaces today's default of `lab`. The `lab` status option stays for
non-glider assets, which keep their manual `asset_status_history` path.

The refurbishment logsheet hangs off the mission/build record
(`findByMission`), and a *workshop*-status build can hold one (confirmed
2026-11-25), so rule 5 applies to workshop builds as well as scheduled ones.

### Scheduled

Separate from State: `scheduled_mission_id` (and the mission's planned date if
it has one) comes from an open mission/build with status `scheduled`. It never
changes State.

### `pre_mission_servicing`

The workshop plus its logsheet *is* the pre-mission preparation. The event type
stays in the table so historical rows still display, but is **removed from the
Add-event menu** and no longer drives a state. An open one on an old row is
treated as a normal servicing event (rule 4): the view maps it to
`in_house_repairs`, not the old `pre_mission_service`. The
`pre_mission_service` status option is left in place.

---

## 4. Clearance is invalidated by edits

"Ready to deploy" must not outlive the thing that was signed off.

- **Logsheet edited:** a cleared logsheet is locked; editing needs the existing
  *unlock*, which already withdraws clearance and records a reason.
- **Build edited:** new. A build change on a glider with a cleared logsheet
  withdraws the clearance in the same transaction (`cleared_at`/`cleared_by`
  set to NULL). It is logged in `refurb_clearance_log` as an `unlocked` row
  with reason "Build edited" — that table only allows `cleared` / `unlocked`,
  and withdrawal *is* an unlock, so no schema change is needed. State drops to
  Workshop on its own because the rule in §3 reads `cleared_at`.
- Verified on `ogdb-test`: clearing a workshop build's logsheet gives Ready to
  deploy; clearing `cleared_at` again gives Workshop.
- Both write a timeline marker: "Clearance withdrawn — build edited".

---

## 5. Location

### Recorded, optional, flat

No precise positions (no shelves, racks or rooms). A small flat list of
places:

```
locations                         asset_location_history
  id                                id
  name  (UNIQUE)                    asset_id      -> assets
  active BOOLEAN                    location_id   -> locations
                                    effective_date DATE
                                    note TEXT NULL
                                    changed_by -> users
```

- Seed: `Bergen lab`, `Teledyne Webb`, `NOC`, `IOP`, and whatever else you add
  later via the portal (a vessel, another partner institute). A `locations`
  row is cheap to add, so the list grows only when you need it.
- `asset_location_history` is append-only, "current = latest by date" — same
  pattern as `asset_status_history`. Keyed on `asset_id`, so batteries,
  sensors and spares can have a location too (useful for the lab inventory).
- Both tables get the existing `audit_log` trigger.

### One shared list, managed in the portal

The places are **data, not code**: a `locations` row per place, added, renamed
and deactivated on the portal's **Locations** page (editors and admins; everyone
can read). One list for everyone, deliberately — a location is a fact about the
asset, so "Lab" has to mean the same thing to every user, or history, filters
and reports stop being comparable. Anyone who needs another place adds it.

- **Rename** changes the name everywhere it is used (history points at the id).
- **Deactivate, never delete:** a deactivated place is hidden from pick lists
  but stays on the history that references it. The page shows how many assets
  currently read each place so you can see what you are deactivating.
- Names are unique ignoring case ("bergen lab" ≠ a second "Bergen lab").

Considered and not done: *per-user private lists* (breaks the shared meaning
above) and *per-organisation places* (a later option, scoped by `agency_id`, if
a partner institute ever needs its own). If the shared list grows long, the
fallback is **per-user favourites** — a small preferences table that changes
which places a user's pick list shows, without splitting the data.

**Recording a location** (`POST /assets/:id/locations`, editors/admins; the
"Set" / "Change" link on the glider header) is optional and refuses the cases
that would silently not count: a deployed / missing / destroyed glider (its
location is fixed by its state), a deactivated place, a future date, or a date
earlier than the glider's last recovery (the staleness rule would ignore it).

### Display

```
Location: Lab · (since 12 Jun)
```

Place name and the date it was recorded, nothing finer.

### The staleness rule

A recorded location only counts if it was recorded **on or after the
glider's last retrieval**. Otherwise the glider shows
`Location: not recorded` in neutral grey (not a warning).

So:

- A glider recovered on 3 Jun whose last location row is "Lab, 20 Apr" reads
  *not recorded*, not "Lab".
- It reads Lab again the moment someone records it — or never, if nobody cares.
- A glider that has never deployed just uses its latest row.

### Derived overrides

Some states fix the location, whatever is stored:

| State | Location shown |
|---|---|
| Deployed | At sea (a lab location cannot be set while deployed) |
| Missing | Unknown |
| Destroyed | — (none) |
| everything else | latest valid recorded location, else *not recorded* |

A factory-repair event does **not** derive Teledyne Webb: that would hard-code
a place name in a view. Instead the "Send to Teledyne" action in the Log menu
pre-fills (skippably) a location row for Teledyne Webb.

Implemented in one view, `current_asset_location`
(`location_source`: `at_sea` / `unknown` / `none` / `recorded` /
`not_recorded`), so the gateway doesn't re-implement the rule per query.
Verified on `ogdb-test`: a row dated before the last retrieval reads *not
recorded*; one dated on the retrieval day counts; a destroyed glider reads
none; a non-glider asset's row never expires.

### Non-glider assets

Same table. No staleness rule (they don't have missions of their own); the
location persists until changed. Whether an attached component should inherit
its glider's location is deferred (§11).

---

## 6. How things change: what's automatic, what you do

State and Scheduled are never set. You log events; they follow.

| You do | Writes | Happens automatically |
|---|---|---|
| **Start workshop** | workshop build (copy of last flown) | State → Workshop |
| **Edit build/logsheet** on a cleared glider | build change | clearance withdrawn, State → Workshop, timeline marker |
| **Clear the logsheet** | `cleared_at` | State → Ready to deploy |
| **Create a mission** for the glider | scheduled mission | Scheduled tag appears; State unchanged |
| **Deploy** (mission start) | `deployment_date` | State → Deployed; Location → At sea |
| **Recover** (mission end) | `retrieval_date` | State falls back (Workshop / Ready / Idle); Location → *not recorded*; optional "Where is it now?" prompt |
| **Send to Teledyne / Transit / On loan / Field test** | open service event | State → In service |
| **Close that event** | `end_date` | State falls back; optional "Where is it now?" prompt |
| **Went missing / Found** | open / close `missing` event | State → Missing / falls back; prompt on found |
| **Destroyed** | `destroyed` event | auto-decommissions; Location → none |
| **Decommission** / **Return to service** | `decommissioned_date` + reason | Decommissioned tag; children cascade (existing) |
| **Set location** (one click on the location line) | `asset_location_history` row | nothing else changes |

### Never forced

- Every "Where is it now?" prompt has **Skip**. The app never blocks on
  location.
- *Not recorded* is a normal, neutral display.
- Lab servicing events with an end date at creation are closed spans and do
  not affect State.

---

## 7. Guards (write-time rules the derivation can't enforce)

**Built 2026-11-25** (service layer; 23 checks against `ogdb-test`, run in a
rolled-back transaction). Each refusal says what to do instead.

1. **No decommission while the glider is Deployed**
   (`AssetsService.setDecommission`). Recover it, or close the mission, first.
   A *Missing* glider can be decommissioned -- that is how a lost one is
   recorded -- and a Destroyed one already is. This is deliberately about the
   derived *state*, not "any open mission row", so a lost glider whose mission
   was never closed isn't stuck.
2. **Nothing can happen to a Destroyed glider after it** (`ServicingService`,
   on both log and edit). An event dated or ending after the destruction is
   refused, and so is one left open. Backfilling an *earlier* event is still
   allowed as long as it has an end date on or before the destruction. A
   second `destroyed` event is refused ("edit that one"), and logging a
   destruction dated before existing events is refused until they are moved.
3. **No return to service while a `destroyed` event stands**
   (`setDecommission`). Otherwise the glider would be "in service" yet still
   read Destroyed. A destroyed event logged by mistake is corrected on the
   timeline by *deleting it* or *editing its type*, after which
   return-to-service works.
4. **No lab location while deployed / missing / destroyed**
   (`LocationsService.recordForAsset`; the Set/Change link is also hidden).
5. **A build edit withdraws a clearance** (section 4;
   `withdrawClearanceTx` in `build.helpers.ts`), called from every build-edit
   path: `applyMissionBuildChangesTx` (the build editor *and* the logsheet's
   sensors / batteries / final-prep saves) and the copy-build action. The build
   editor shows it as a "Warning: Clearance withdrawn..." line; an empty batch
   changes nothing.

6. **Deleting an event** (`DELETE /assets/:id/servicing/:eventId`, the "Delete
   event" button in the edit dialog, with a confirmation) is for one that
   should never have been logged; a merely wrong one is edited. A hard delete,
   but not silent: the audit log keeps the removed row **credited to the person
   who deleted it** (the row is stamped first, since a DELETE audit entry
   otherwise carries its last editor). It is limited to the event types the
   dialog manages and refused if a calibration record links to it. Attached
   files go with it (rows in the transaction, stored files after the commit).
   Deleting a `destroyed` event also removes the decommission it applied
   (`decommissioned_date` + reason `destroyed`) so the glider returns to
   service -- unless that decommission was changed since, in which case it is
   left alone. Events the destruction auto-closed stay closed, and a
   decommission it replaced earlier is not restored. Tested on `ogdb-test` (17
   checks, rolled back).

7. **A destroyed / missing event can close the glider's open mission**
   (built 2026-11-25). A mission's status is *stored* -- unlike the glider's
   derived state -- so a glider destroyed mid-mission used to leave that mission
   `active`: still on the home page's "out at sea" list and blocking "Start
   workshop". Now the event dialog offers, tick-boxed and on by default, to
   close the open mission in the **same transaction** as the event
   (`closeMissionTx`): *destroyed* -> status `killed in action`, plus (second
   tick-box, on by default) retrieval date = the event date, right for a glider
   destroyed during recovery, wrong for one lost at sea; *missing* -> `missing
   in action`, dates untouched. A missing-in-action mission can still be closed
   out by a later destruction. Only an open mission of *that* glider qualifies
   (started, no retrieval date, not workshop/scheduled), and the end date can't
   precede the mission's start; any refusal rolls back the event too. The
   reverse direction is a prompt, not a write: saving a mission as killed /
   missing in action offers (skippably) to log the matching event on the
   glider, and skips the "Where is it now?" prompt in that case. Neither side
   writes the other behind your back, so they can't loop. Deleting a
   destroyed event does not reopen a mission it closed (the confirmation says
   so). 16 gateway checks against `ogdb-test`, rolled back.

8. **Components go down with the glider -- optionally** (built 2026-11-26).
   Logging *Destroyed* shows the glider's last build as a checklist; **none are
   ticked by default** (some parts are recovered or still usable) and "Select
   all" is one click. *Decommission* shows the same list with **all ticked** by
   default (untick to keep in service). Ticked components get the same date and
   reason as the glider, plus a status row (`destroyed` / `decommissioned`) so
   they read that way in the asset tables, which filter on status. Sub-parts
   follow their parent when ticked. **"Last build" is the glider's *current* build:**
   the workshop / scheduled build if one exists, otherwise the last flown
   mission's -- the same rule as the glider page's "Current build" -- not just
   the last flown mission as before (`fetchLatestBuildTree`). Nothing links the
   destruction to the mission; the mission is simply where that build lives.
   Guards (`retireComponentsTx`, one transaction with the event): components must
   be in that build (refused otherwise, not silently ignored, for a destruction);
   a part that has since moved into *another* glider's open build is refused,
   listing the serial numbers; and the status row is dated
   max(event date, the part's latest status date), because "current status" is
   the latest row by date and a backdated destruction would otherwise sit behind
   a later "lab" row. The asset and battery tables now hide anything with a
   decommission date, or a `decommissioned` / `destroyed` status, behind "Show
   decommissioned". **Deleting the destroyed event reverses the cascade**:
   its status rows carry a `[event <id>]` marker, are removed (restoring each
   part's previous status), and the decommission is cleared where it still
   matches. 22 checks against `ogdb-test`, rolled back.

9. **"Servicing required" is a separate flag, not part of the state model**
   (2026-11-26): an event type that marks an asset do-not-deploy until repaired,
   with a red chip, a home-page list, and a guard on clearing. It never changes
   the derived state. See `servicing-required.md`.

Destroyed-implies-decommissioned already holds when a destroyed event is
*logged* (it stamps `decommissioned_date`). **Known gap, unchanged:** editing an
existing event's type *to* destroyed does not stamp the date, so that path can
leave a destroyed glider un-decommissioned. Worth a follow-up (or a trigger).

---

## 8. UI

**Glider header**

```
[ Workshop ]   Scheduled · GL_xxx    Decommissioned (tag, only when set)
Location: Lab · (since 12 Jun)  [change]
```

**One "Log" menu** (replaces *Add event*), grouped:

- *Movement* — Send to Teledyne · Transit · On loan · Field test · Update location
- *Preparation* — Start workshop
- *Incidents* — Went missing · Destroyed
- *Fleet* — Decommission · Return to service

Deploy and Recover stay on the mission page; saving a retrieval triggers the
skippable "Where is it now?" prompt.

**Fleet table:** State, Location and Scheduled columns with filters;
"Retired" is renamed **Decommissioned** everywhere in the UI. The
"Show decommissioned" filter keys off `decommissionedDate`.

---

**Editing from a table: a spanner, never the row.** Every editable table in the
portal carries a spanner button (`EditRowButton`) at the end of the row: the
glider page's All events and Servicing & status tables, the asset page's
Calibrations table, and an RMA's assets table and events timeline (beside the
date). The timeline chart's per-card edit button uses the same icon. Rows
themselves are no longer clickable to edit, so a highlighted, pointer-cursor
row means exactly one thing: *it opens another page*.

## 9. Timeline

- **Spans:** workshop (start → deploy), missions, service events (as now).
- **Markers:** clearance given / withdrawn, decommissioned, destroyed.
- **Location changes** are small markers, **hidden by default** behind a
  "Show locations" toggle — the same approach as hiding sensor calibrations,
  so recording locations never clutters the view.

---

## 10. Changes

### OGDB (schema) — done on `ogdb-test`, not on prod

`xxxx_asset_locations` (purely additive, safe to deploy ahead of the portal):

1. `locations`, `asset_location_history` (+ audit triggers, index on
   `(asset_id, effective_date DESC)`).
2. `asset_status_options`: add `workshop`, `ready_to_deploy`, `idle`.
3. Seed `locations`: Bergen lab, Teledyne Webb, NOC, IOP.

`xxxx_glider_state_and_location_views` (**must ship with the portal update**:
gliders that read `lab` now read `idle`, and an old portal shows an unmapped
chip):

4. `derived_asset_status` extended with the §3 rules, plus appended columns
   `scheduled_mission_id` and `scheduled_date`.
5. New view `current_asset_location` (§5).

Note the live `missions` columns are `deployment_date` / `retrieval_date`
(older migration files say `launch_date` / `recovery_date`; they were renamed
later).

### OGDB-portal

- **Types / labels:** `AssetStatus` gains the three new values;
  `status-meta.ts` labels/colours; `Glider` gains location and scheduled
  fields; "Retired" → "Decommissioned".
- **Gateway:** location endpoints (record, list, add/rename/deactivate; built);
  auto-withdraw clearance on build edit; the §7 guards; `SELECT_FLEET` reads the
  new views. Add `asset_location_history` to `AUDITED_ASSET_ID_TABLES` in
  `common/asset-tables.ts` so location changes show in an asset's change log.
- **Dashboard:** header, Log menu, "Where is it now?" prompt, fleet table
  columns/filters, timeline markers.
- **Docs:** `derived-glider-status.md` gets a pointer to this doc.

### Order of work

1. ~~OGDB migrations on `ogdb-test`~~ — done 2026-11-25.
2. ~~Gateway read path (`SELECT_FLEET`) + types~~ — done 2026-11-25:
   `SELECT_FLEET` joins `current_asset_location` and returns `location`,
   `locationId`, `locationSince`, `locationSource`, `scheduledMissionId`,
   `scheduledDate`; `AssetStatus` gains `workshop` / `ready_to_deploy` /
   `idle`; `status-meta` has their labels and colours. The existing chip,
   tooltip and status box already render the new states (their "from a
   mission" / "nothing logged" wording was corrected).
3. ~~Fleet table and header (read-only first)~~ — built 2026-11-25
   (typechecks; awaiting an in-browser look): fleet table has State and
   Location columns, a Scheduled tag, State / Location / Scheduled filters,
   "Show decommissioned"; the glider header and status box show the State
   chip, Scheduled tag (links to the mission), Decommissioned tag and a
   `Location: Lab · (since 12 Jun)` line (grey "Not recorded" when empty).
   "Retired" is now "Decommissioned" everywhere in the UI, including the
   Add-event dialog (option "Decommission"). Shared formatting lives in
   `dashboard/src/lib/glider-location.ts`. Read-only: no way to *set* a
   location yet (step 4).
4. Write paths. **Done 2026-11-25 (location part):** gateway `locations`
   module (list / add / rename / deactivate), `POST /assets/:id/locations`
   with its guards (service tested against `ogdb-test`, 22 checks), the
   Locations page and nav entry, a "Set" / "Change" dialog on the glider
   header, and the home page's workshop list now shows the glider's real
   location instead of a hard-coded "In-house workshop". The §7 guards and
   clearance withdrawal are done too (see §7).
5. ~~Log menu and prompts~~ — built 2026-11-25 (typechecks and lints; **not
   yet seen in a browser**): `GliderLogMenu` in the glider header (editors
   only), replacing "Add event" for gliders. Items that don't apply are greyed
   out with the reason underneath (deployed / destroyed / an open event), so
   the menu mirrors the gateway's guards. **Added to the doc's list:** *Lab
   service* under Preparation (the "In service" state still needs somewhere to
   be logged). "Close open event…" appears at the top when one is open (a destroyed event never counts as open: it is terminal). For a destroyed glider the menu offers "Edit destroyed event…" instead, the way to correct a mistaken one. The
   event dialog opens already set to the chosen type (picker hidden) with a
   suggested title; non-gliders keep the plain "Add event" button. The
   timeline tab keeps the open-event notice and click-a-row editing. Skippable
   "Where is it now?" prompts (shared `LocationDialog`) follow: closing an
   event (it's back / found), sending to Teledyne (pre-selects the Teledyne
   place), and saving a first recovery date on a mission (the mission dialog
   fetches the places itself, since three pages open it).
6. Timeline markers.
7. Backfill (§11) and deploy.

---

## 11. Open / deferred

- **Backfill.** SG561 (and the other retired gliders) need their `destroyed` /
  `missing` events logged on production so they stop reading "Idle". SG561's
  destroyed event (2026-03-06, ship strike on recovery) will be entered by
  hand through the Log menu once it exists; the other gliders can use
  `OGDB/scripts/backfill_derived_glider_status.sql` and the audit query.
- **Inherited location for attached components.** Attached parts could take
  their glider's location; spares use their own. Deferred until the lab
  inventory shows whether it's needed.
- **Inventory tie-in.** Counting an asset in the lab can write a location row
  for it, so "present" and "has a recent lab location" coincide.
- **Clearance expiry by time.** Only edits invalidate clearance. A glider
  cleared months ago and untouched stays Ready to deploy; the header shows the
  clearance date so it can be judged by eye.
- **Precise location (shelves, racks).** Explicitly out of scope. `locations`
  is flat; adding a `parent_id` later would not break anything if it is ever
  wanted.
