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

## Science sensor NVS backing (2026-08-16, applied 2026-08-17)

**Status: fully applied**, to both `ogdb-test` and production —
`xxxx_nvs_back_science_sensors` + `xxxx_rename_platform_nvs_constraints`.
All 35 sensors have real `l05_family_id`/`l22_model_id`. `asset_sensor_parameters`
exists and is empty, ready for the P01 term list below.

Fiona matched all 35 science sensors' legacy model text (preserved in
`assets.notes` through the backfill, e.g. "Legacy model: GPCTD") against
real NVS L22 terms. Consolidates 14 legacy model strings down to 11 real
distinct models — three DO strings (`4330I F`, `4831F IW`, `4330IE`) turned
out to be depth-rating suffixes on an existing model, not separate models,
and need their own field rather than being folded into the model name.

| Type | Legacy model | Count | L22 term |
|---|---|---|---|
| CT | GPCTD | 9 | TOOL1026 — Sea-Bird SBE Glider Payload CTD |
| CT | APL-GLIDER.LEGACY | 8 | TOOL1188 — rename to "CT Sail" |
| CT | legato | 1 | TOOL1745 — rename to "Legato-3" |
| CT | *(none yet)* | 0 | TOOL2261 — "Legato-4", added for future purchases |
| DO | 4831F | 3 | TOOL1240 — rename "AADI-4831F" |
| DO | 4330F | 2 | TOOL1248 — rename "AADI-4330F" |
| DO | 4330 | 1 | TOOL1247 — rename "AADI-4330" |
| DO | 3830 | 1 | TOOL0836 — rename "AADI-3830" |
| DO | ~~4330I F~~ | 2 | not a separate model — same as 4330F, depth rating "I" needs its own field |
| DO | ~~4831F IW~~ | 1 | not a separate model — same as 4831F, depth rating "IW" needs its own field |
| DO | ~~4330IE~~ | 1 | not a separate model — same as 4330, depth rating "IE" needs its own field |
| ECO | BB2FLVMT | 2 | TOOL1310 — rename "BB2FL-VMT" |
| ECO | FLNTUSLK | 2 | TOOL1993 — rename "FLNTU-SLK" |
| ECO | FLNTUSLO | 1 | TOOL2257 — rename "FLNTU-SLC" (real correction, not just reformatting) |
| MR | MR1000 | 1 | TOOL1232 — rename "MicroRider-1000" |

**L05 device category — one per sensor type**, verified directly from each
L22 term's own "Related L05 Device Categories" cross-mapping (several
devices map to more than one L05 category on the NVS side — e.g. the
MicroRider genuinely maps to five, since it bundles shear probes,
thermistor, conductivity, pressure, and attitude sensing in one housing —
but OGDB only needs one representative category per sensor type, not the
full multi-mapping):

| Sensor | L05 |
|---|---|
| CT | L05:130 — CTD |
| DO | L05:351 — Dissolved gas sensors |
| ECO | L05:113 — Fluorometers |
| MR | L05:184 — Microstructure sensors |

**P01 (parameters)**: not yet resolved — NVS's parameter search isn't
accessible via automated fetch, so Fiona is compiling the real P01 term
list by hand and will bring it back. What each sensor measures, for
reference: CT → temperature, conductivity, pressure (derived: salinity); DO
→ dissolved oxygen concentration, saturation, sensor temperature; ECO
(BB2FL-VMT) → chlorophyll fluorescence, optical backscatter (two
wavelengths); MR → shear, temperature microstructure, turbulent kinetic
energy dissipation rate.

### Schema decision: collection-prefixed FKs + normalized `nvs_terms` + friendly views

Considered fully denormalizing (flat `NVS_B76_id`/`NVS_B76_preferred_name`/
`NVS_B76_url`/`NVS_B76_details` columns directly on `platforms`, replacing
the FK-into-shared-cache pattern). Rejected for two reasons: it duplicates
the same term's label/definition text across every table that references
it (one edit becomes N edits if NVS ever renames or deprecates a term), and
it structurally can't represent parameters at all — a single CTD outputs
several P01 parameters, so "one flat NVS_P01 column per sensor" is already
wrong for the simplest case. Same reasoning as the MicroRider's five L05
categories: some relationships are inherently many-valued.

**Settled shape**: `nvs_terms` stays the single normalized cache (it
already has `id`/`uri`/`pref_label`/`definition` — exactly the fields
needed), existing FK columns get renamed to name which collection they draw
from, and a real many-to-many table handles parameters. Friendly views give
the flat, join-free browsing Fiona wants in a DB client without duplicating
the underlying data.

```sql
-- 1. Rename existing FKs to be collection-explicit
ALTER TABLE platforms RENAME COLUMN platform_model_id TO b76_model_id;
ALTER TABLE platforms RENAME COLUMN platform_category_id TO l06_category_id;
ALTER TABLE asset_sensor_details RENAME COLUMN sensor_family_id TO l05_family_id;
ALTER TABLE asset_sensor_details RENAME COLUMN model_id TO l22_model_id;

-- 2. Many-to-many: which P01 parameters a given sensor actually outputs
CREATE TABLE asset_sensor_parameters (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id),
    p01_term_id INTEGER NOT NULL REFERENCES nvs_terms(id),
    changed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (asset_id, p01_term_id)
);
CREATE INDEX ix_asset_sensor_parameters_asset_id ON asset_sensor_parameters(asset_id);
CREATE TRIGGER asset_sensor_parameters_audit
    AFTER INSERT OR DELETE OR UPDATE ON asset_sensor_parameters
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

-- 3. Friendly views — flat NVS_<collection>_* shape, no join needed to browse
CREATE VIEW platforms_with_nvs AS
SELECT p.*,
    b76.uri AS "NVS_B76_url", b76.pref_label AS "NVS_B76_preferred_label", b76.definition AS "NVS_B76_definition",
    l06.uri AS "NVS_L06_url", l06.pref_label AS "NVS_L06_preferred_label", l06.definition AS "NVS_L06_definition"
FROM platforms p
LEFT JOIN nvs_terms b76 ON b76.id = p.b76_model_id
LEFT JOIN nvs_terms l06 ON l06.id = p.l06_category_id;

CREATE VIEW asset_sensor_details_with_nvs AS
SELECT d.*,
    l05.uri AS "NVS_L05_url", l05.pref_label AS "NVS_L05_preferred_label", l05.definition AS "NVS_L05_definition",
    l22.uri AS "NVS_L22_url", l22.pref_label AS "NVS_L22_preferred_label", l22.definition AS "NVS_L22_definition"
FROM asset_sensor_details d
LEFT JOIN nvs_terms l05 ON l05.id = d.l05_family_id
LEFT JOIN nvs_terms l22 ON l22.id = d.l22_model_id;

CREATE VIEW asset_sensor_parameters_with_nvs AS
SELECT sp.id, sp.asset_id,
    p01.uri AS "NVS_P01_url", p01.pref_label AS "NVS_P01_preferred_label", p01.definition AS "NVS_P01_definition"
FROM asset_sensor_parameters sp
JOIN nvs_terms p01 ON p01.id = sp.p01_term_id;
```

No changes needed to `sync_nvs_terms.py` — it's already generic per
collection. Once the P01 term list is ready, add those URIs to
`nvs_terms.yaml` and run it, same as B76/L05/L22 already work.

## Manufacturer NVS backing (2026-08-17)

**Status: fully applied** — `xxxx_nvs_back_manufacturers`, same
collection-prefixed-FK-into-`nvs_terms` + friendly-view pattern as above,
this time for **L35** (SenseOcean Device Developers and Manufacturers).

| `manufacturers.name` | L35 term |
|---|---|
| TWR | MAN0020 — Teledyne Webb Research |
| IOP | MAN0024 — University of Washington |
| RBR | MAN0049 — RBR |
| SBE | MAN0013 — Sea-Bird Scientific |
| Electrochem | *(no L35 entry — battery-cell supplier, not an oceanographic device maker; left unbacked, not removed)* |

Dropped `manufacturers.long_name` (redundant with the NVS-sourced
preferred label once backed) and added `l35_manufacturer_id` +
`manufacturers_with_nvs`. `manufacturers.url` was kept as-is — each
manufacturer's own website, a different thing from the NVS term's own
URI (`NVS_L35_url` on the view).

Confirmed before dropping anything: Electrochem is referenced by 4
`battery_models` rows, so it stays in the table regardless — same
"nothing forces every row to resolve to an NVS term" reasoning as
`depth_rating` staying `NULL` for sensors that never had one.

## Data cleanup: six orphaned glider-asset rows (2026-08-17)

Found while investigating why the Gliders Fleet catalogue and the All
Assets catalogue appeared to disagree on status for the same gliders.
They didn't — `gliders.service.ts` uses an inner join to
`asset_glider_details`, `assets.service.ts` uses a left join. Six
`assets` rows (ids 179–184, serial numbers 559–564 — the same serials as
the six real Seagliders, ids 1–6) had no matching `asset_glider_details`
row at all, so they were silently excluded from Fleet but showed up in
All Assets as blank rows with no status.

Root cause: leftover duplicates from the original Phase 1 backfill —
`created_at` on all six is `2026-08-08 22:13:48`, in the middle of that
backfill run. Confirmed zero references anywhere (`asset_status_history`,
`asset_assignments`, `asset_service_events`, `documents`,
`legacy_asset_id_map`, `missions`, `firmware_history`, `piloting_log`)
before deleting. Removed from both `ogdb-test` and production via direct
`DELETE FROM assets WHERE id IN (179,180,181,182,183,184)` — data-only,
no migration, since it's cleanup of bad rows rather than a schema
change.

## Real remaining gaps

Split by which side owns the fix:

**OGDB-portal (this repo) — the actual next work:**
- ~~**Nothing in the gateway queries `asset_assignments` yet.**~~ —
  **resolved 2026-08-17.** `GET /gliders/:id/build` now walks the full
  tree recursively (`build.helpers.ts`) and the glider detail page's
  Current Build/Science Payload/Servicing History/Editing History
  sections are real, not placeholders. Only tested end-to-end for Durin
  so far, since it's the only glider with clean (non-legacy-ambiguous)
  assignment data — the mission page's Science Payload/Glider build
  boxes are still not wired up.
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
- **No part-model concept for most asset types.** Science sensors have a
  real model (NVS L22), and batteries/hulls have `battery_models`/
  `hull_models` lookup tables — but forward/aft section, end cap, energy
  bay, payload bay, and altimeter have no model field at all. Surfaced
  concretely by the glider build page's Model column (2026-08-17):
  everything outside those three types just shows "—". Needs a real
  schema decision (a shared `part_models` table? per-type like
  `battery_models`? a flat text column?) once it's clear what data is
  actually available to populate it with — not decided yet.
- **12 components (27 rows) are flagged ambiguous** — the backfill couldn't
  determine ordering when a component appeared under multiple parents with
  no dates to sequence the move. Queryable via `WHERE notes LIKE '%ambiguous
  ordering%'`. Needs manual review to pick the correct current owner.
- **`event_log`/`log_*` family (171 real rows) is untouched** — old logging
  system, still there, still live, not yet folded into
  `asset_service_events`/`piloting_log`.
- ~~**NVS platform backing** (L06/B76 for `platforms`)~~ — **resolved
  2026-08-16, not a gap.** Design notes called this deferred, but it's since
  been completed: all 6 `platforms` rows have `platform_model_id` (B76) and
  `platform_category_id` (L06) populated.

  Also settled: `asset_glider_details.platform_id` should keep pointing at
  `platforms`, not directly at a B76 term. `platforms.model` (free text —
  "G3", "G3 persistor", etc.) is more granular than B76 — "G3" and "G3
  persistor" are two different `platforms` rows sharing the *same* B76 term,
  so collapsing straight to NVS would lose that distinction. `platforms`
  also carries `manufacturer_id`, which B76 doesn't. Same class-table-
  inheritance pattern as everywhere else: the local table holds the NVS
  reference as one attribute, it doesn't become the NVS term.

## Pending schema change

- Rename asset type `nose_cone` → `slocum_recovery_nose`. Decided in this
  planning thread, not yet applied — needs its own migration on the OGDB
  side.
- P01 parameter rows in `asset_sensor_parameters` — table exists, empty.
  Blocked on Fiona's P01 term list before `sync_nvs_terms.py` has
  anything to load for the parameters side.
