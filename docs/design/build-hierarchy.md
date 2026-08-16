# Build hierarchy — status

**This describes an already-built system, not a proposal.** The asset build
hierarchy was fully designed and implemented in a separate Claude Code
session working in `~/projects/OGDB` (Aug 8–10), independently of the
planning discussion that started this doc. That session's full decision log
is symlinked into this project at
[`.claude/rules/ogdb-design-notes.md`](../../.claude/rules/ogdb-design-notes.md)
and loads automatically into every session here — read it for the complete
reasoning. This doc is the summary plus the remaining gap list, kept
specific to what OGDB-portal (this repo) still needs to do.

## What's already built

- **`assets`** (178 rows) — every physical, trackable thing (sensor,
  section, battery, glider itself) is one row, typed via `asset_type_id`.
- **`asset_assignments`** (88 rows) — the hierarchy table. Self-referential
  (`child_asset_id` / `parent_asset_id`, both FK → `assets.id`), date-ranged
  (`start_date` not null, `end_date` nullable — current = `end_date IS
  NULL`), plus `position` (free text, e.g. `pitch`/`extended`/`aft` for
  batteries — distinguishes multiple same-type children under one parent),
  `mission_id` (FK → `missions`, nullable — see gap below), `notes`,
  `changed_by`, full audit trail via `asset_assignments_audit` trigger. One
  `CHECK` constraint (`child_asset_id <> parent_asset_id`); no other
  constraint restricts what can be whose parent yet.
- **Per-type detail tables** (class-table inheritance): `asset_glider_details`,
  `asset_sensor_details` (shared by CT/DO/ECO/MR), `asset_battery_details` +
  `battery_models`, `asset_slocum_*_details` for aft_section, end_cap,
  forward_section, hull, payload_bay. Types with nothing beyond generic
  columns (`slocum_altimeter`, `slocum_thruster`, `argos_tag`, `nose_cone`)
  have no detail table.
- **Calibration tables** (`asset_ct_sensor_cal`, `asset_do_sensor_cal`,
  `asset_eco_sensor_cal`, `asset_slocum_forward_section_cal`) — current =
  latest row by date, same pattern as status.
- **`asset_status_history`** + **`current_asset_status`** view — status is a
  real timeline (append-only), not a flat column.
- **`asset_service_events`** + **`asset_service_event_types`** — append-only
  per-asset history (calibration, pressure test, servicing, inspection,
  refurb, factory_repair), independent of current parent.
- **`asset_faults`** — separate lifecycle (open → investigating →
  sent_for_repair → resolved), kept apart from the flat service-event log.
- **`documents`** — polymorphic (attaches to a service event, fault, asset,
  or mission), reference-only column pointing at Nextcloud.
- **`legacy_asset_id_map`** (178 rows, permanent) — old table/id → new
  `assets.id`, used throughout the backfill and kept for provenance.
- Migration chain fully applied through `drop_users_name` (head). Backfill
  phases 1–3 all done and verified (asset/detail rows, calibration rows,
  assignment rows all reconciled against source counts).

## Confirmed: our independent design matched this

The planning discussion that led to this doc (before the OGDB session was
discovered) arrived at the same model independently:

- **Batteries stay as ordinary `assets` rows** — no separate consumables
  table. Confirmed by the real schema: `asset_battery_details` +
  `battery_models`, nothing else.
- **Single self-referential table**, not per-mission snapshots or a flat
  current-parent pointer — matches `asset_assignments` exactly.
- **Seaglider vs. Slocum needs no special-casing** — validated in the OGDB
  session against real gliders (Durin, Ægir): Seaglider sensors attach
  directly to the glider, Slocum sensors route through the payload bay,
  same table, same columns, no branching logic.
- **`position` as a set, not a single value, per asset type** — our
  `ct_sensor`/`eco_sensor` example (valid parents: `glider` *and*
  `slocum_payload_bay`) matches how the real system already models it.

One thing the real schema has that we hadn't derived: the `position` column,
for distinguishing multiple same-type children under one parent (e.g. three
batteries in three physical slots on the same glider).

## Valid parent(s) by asset type

Still the right reference for the eventual write-path validation (see
enforcement gap below) — this was worked out against the real 16-type list,
independent of the OGDB session:

| Asset type | Valid parent(s) |
|---|---|
| glider | — (root) |
| slocum_recovery_nose *(pending rename, see below)* | glider |
| slocum_aft_section | glider |
| slocum_altimeter | glider |
| slocum_energy_bay | glider |
| slocum_forward_section | glider |
| slocum_hull | glider |
| slocum_payload_bay | glider |
| slocum_thruster | glider |
| do_sensor | glider |
| mr_sensor | glider |
| battery | glider |
| argos_tag | glider |
| ct_sensor | glider, slocum_payload_bay |
| eco_sensor | glider, slocum_payload_bay |
| slocum_end_cap | slocum_aft_section |

## Real remaining gaps

Split by which side owns the fix:

**OGDB-portal (this repo) — the actual next work:**
- **Nothing in the gateway queries `asset_assignments` yet.** This is why
  the glider's Current Build box and the mission's Science
  Payload/Glider build boxes are still "coming soon" placeholders, even
  though the real data has existed since Aug 9. Wiring this up — not
  designing it — is the next concrete task.
- **Write-path validation isn't built.** Confirmed via DB client access
  (Fiona), so this has to be enforced at the DB level (a real trigger, not
  just a gateway-side check) once a write path for `asset_assignments`
  exists. The valid-parent table above is the ruleset to encode.

**OGDB (schema/data side) — tracked here for visibility, not ours to fix:**
- **`mission_id` is a real column but unpopulated** on all 88 existing rows
  — the backfill script never attempted to infer it from dates. Not a
  blocker (mission-scoped views can still be derived from `start_date`/
  `end_date` overlap), but populating it directly would make that lookup
  exact instead of inferred.
- **12 components (27 rows) are flagged ambiguous** — the backfill couldn't
  determine ordering when a component appeared under multiple parents with
  no dates to sequence the move. Queryable via `WHERE notes LIKE '%ambiguous
  ordering%'`. Needs manual review to pick the correct current owner.
- **`event_log`/`log_*` family (171 real rows) is untouched** — old logging
  system, still there, still live, not yet folded into
  `asset_service_events`/`piloting_log`.
- **NVS platform backing** (L06/B76 for `platforms`) — deliberately
  deferred, not started.

## Pending schema change

- Rename asset type `nose_cone` → `slocum_recovery_nose`. Decided in this
  planning thread, not yet applied — needs its own migration on the OGDB
  side.
