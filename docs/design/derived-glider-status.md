# Derived glider status — plan

**Status (2026-09-02):** migrations applied to ogdb-test; portal gateway +
types + UI (phases 2 and 3 below) implemented and typechecking. Not yet
committed or deployed. Remaining: the per-glider §7 backfill, an
authenticated browser smoke-test, and the prod migration + deploy.

**This is a proposal, not a built system.** It replaces the manually-set
status dropdown on the Glider fleet catalogue with a value *derived* from the
glider's timeline (missions + service events), and splits "decommissioned"
out into a separate fleet-lifecycle fact.

Spans two repos:

- **`~/projects/OGDB`** — schema: new asset column, new service-event types,
  new status options, the derived view, a data migration.
- **`~/projects/OGDB-portal`** (this repo) — gateway read path, shared types,
  the "Add event" modal branch, catalogue + detail-page display, deletion of
  the old status write path.

---

## 1. Why

### The problem today

A glider's catalogue status is a hand-curated append-only log
(`asset_status_history`), surfaced via the `current_asset_status` view
(`DISTINCT ON (asset_id) … ORDER BY effective_date DESC`). It is edited by a
`<StatusEditor>` dropdown in `GlidersTable`, which `POST`s a new history row
through `PATCH /gliders/:id/status`.

It is entirely disconnected from the glider's actual activity. The Timeline
tab already assembles a far better picture of "what is this glider doing"
from **missions** (`launch_date` / `recovery_date`) and **`asset_service_events`**
(`servicing` / `factory_repair` / `transit`). Nothing reconciles the two — a
glider can read "Deployed" in the catalogue with no open mission, or sit on
an open `factory_repair` event while the chip still says "Lab".

### "Decommissioned" is two facts, not one

`asset_status_options` is a single flat list, so one glider goes in one
bucket. Real fleet examples need **two independent axes**:

| Glider   | Fleet lifecycle              | Physical state / location |
|----------|------------------------------|---------------------------|
| SG560    | active                       | Deployed                  |
| GNÅ      | retired — "end of life"      | In the lab                |
| SG562    | retired — "lost at sea"      | Missing                   |
| SG561    | retired — "destroyed"        | Destroyed                 |
| URD      | retired — "destroyed"        | Destroyed                 |

SG561 and URD were run over by vessels — *confirmed destroyed*, which is
distinct from SG562 being *missing* (unrecovered, but not known-gone). GNÅ is
just old and unused but physically fine, in the lab.

A single enum collapses GNÅ-in-lab and SG562-lost and SG561-destroyed into
one indistinguishable "decommissioned". Splitting the axes fixes that and
also fixes the catalogue's "Show decommissioned" filter, which currently
keys off `status === 'decommissioned'` and would otherwise lose the "…but
where is it" information.

---

## 2. The model

### Axis A — fleet lifecycle (new)

Two nullable columns on `assets`:

- `decommissioned_date DATE NULL` — `NULL` = active fleet.
- `decommission_reason TEXT NULL` — free text, but the modal offers a
  starting vocabulary: `end of life`, `lost at sea`, `destroyed`, `sold`,
  `transferred`.

Why a **date**, not a boolean or a `lifecycle_state` enum:

- Every "current" fact in this schema is already derived from dated rows
  (`asset_assignments.end_date`, `asset_service_events.end_date`,
  `asset_status_history.effective_date`, the cal tables). A date is
  consistent with that and gives "retired since 2019" for free.
- It plugs into the timeline's existing "as of date X" reconstruction —
  "was this glider active when mission M ran?"
- A full `planned / active / retired / disposed` enum is the alternative if
  more lifecycle states ever matter; the date widens to it later without a
  data change.

### Axis B — operational status (derived)

A view, `derived_asset_status`, computes the current physical state from
missions + open service events. No manual entry for gliders.

**Precedence:**

1. a `destroyed` service event exists → **Destroyed** (terminal)
2. open mission (`launch_date <= today`, `recovery_date IS NULL`) → **Deployed**
3. newest open `asset_service_events` of
   `{factory_repair, servicing, transit, on_loan, field_test, missing}`
   → mapped label
4. otherwise → **Lab**

`decommissioned_date` is independent of all of that and only drives a grey
**Retired** tag next to the operational chip. So:

- GNÅ = `Lab` + Retired
- SG562 = `Missing` + Retired
- SG561 / URD = `Destroyed` + Retired

---

## 3. Event / status taxonomy

Everything the user logs goes through the **"Add event" modal**
(`AddServicingEventDialog`), which branches on the type picked:

| Modal option            | Writes                                                              | Derived status while open | Lifecycle effect             | Closeable?             |
|-------------------------|--------------------------------------------------------------------|---------------------------|------------------------------|------------------------|
| Lab servicing           | `asset_service_events` (`servicing`)                               | In-house repairs          | —                            | yes (add end date)     |
| Factory servicing       | `asset_service_events` (`factory_repair`)                          | Factory service           | —                            | yes                    |
| Transit                 | `asset_service_events` (`transit`)                                 | Transit                   | —                            | yes                    |
| On loan **(new)**       | `asset_service_events` (`on_loan`)                                 | On loan                   | —                            | yes                    |
| Field test **(new)**    | `asset_service_events` (`field_test`)                              | Field test                | —                            | yes                    |
| Went missing **(new)**  | `asset_service_events` (`missing`)                                 | Missing                   | —                            | yes (on recovery)      |
| Destroyed **(new)**     | `asset_service_events` (`destroyed`) **+ sets `decommissioned_date`** | Destroyed               | retires the glider           | no (terminal)          |
| Decommission **(new)**  | `assets.decommissioned_date` + `decommission_reason` only          | *(unchanged — derives)*   | retires the glider           | —                      |

- Only **Decommission** writes no timeline event — that's GNÅ ("just old, in
  the lab"). The chip keeps deriving from events (→ `Lab`).
- **Destroyed** auto-stamps `decommissioned_date` (= the event start date)
  and `decommission_reason = 'destroyed'`. One action, terminal, no separate
  decommission step.
- **Destroyed** and **Decommission** bypass the "one open event per asset"
  guard and auto-close any currently-open service event.

### One-open-event rule

Still holds for the non-terminal types — a glider is in exactly one
operational state at a time. `ServicingService.assertNoOpenEvent` already
enforces it; the terminal actions are the only exceptions.

Known pre-existing gap (not in scope): the guard doesn't see missions, so
someone could log `servicing` while a mission is open. The derivation
precedence (mission wins) at least keeps the *display* correct.

---

## 4. Schema changes (`~/projects/OGDB`)

New Alembic migrations:

1. **`assets` lifecycle columns**
   - `decommissioned_date DATE NULL`
   - `decommission_reason TEXT NULL`
   - (optional) `decommissioned_by INTEGER NULL REFERENCES users(id)` — beyond
     the `audit_log` trigger already on `assets`.

2. **`asset_service_event_types`** — insert `on_loan`, `field_test`,
   `missing`, `destroyed` (`ON CONFLICT (name) DO NOTHING`, matching the
   existing seed migrations). Tighten the `transit` description to
   shipping/transport only, now that `on_loan` stands alone.

3. **`asset_status_options`** — insert `field_test`, `destroyed` so the
   chip's colour/label lookup and any id-join resolve. Keep `decommissioned`
   for generic (non-glider) assets — the `<StatusEditor kind="assets">` path
   and `GliderBuildEditor`'s "set removed component to lab/decommissioned"
   still use `asset_status_history`. Gliders just stop deriving it.

4. **`CREATE VIEW derived_asset_status`** — precedence from §2. Returns
   `(asset_id, status, status_since, status_source)` where
   `status_source ∈ {mission, service_event, default}`.

   ```sql
   CREATE VIEW derived_asset_status AS
   SELECT
     a.id AS asset_id,
     COALESCE(term.status, m.status, se.status, 'lab')       AS status,
     COALESCE(term.since,  m.since,  se.since,  NULL)         AS status_since,
     CASE WHEN term.status IS NOT NULL THEN 'service_event'
          WHEN m.status    IS NOT NULL THEN 'mission'
          WHEN se.status   IS NOT NULL THEN 'service_event'
          ELSE 'default' END                                 AS status_source
   FROM assets a
   LEFT JOIN LATERAL (
     SELECT 'destroyed'::text AS status, se.start_date AS since
     FROM asset_service_events se
     JOIN asset_service_event_types t ON t.id = se.event_type_id
     WHERE se.asset_id = a.id AND t.name = 'destroyed'
     ORDER BY se.start_date DESC LIMIT 1
   ) term ON true
   LEFT JOIN LATERAL (
     SELECT 'deployed'::text AS status, mi.launch_date AS since
     FROM missions mi
     WHERE mi.glider_asset_id = a.id
       AND mi.launch_date <= CURRENT_DATE
       AND mi.recovery_date IS NULL
     ORDER BY mi.launch_date DESC LIMIT 1
   ) m ON true
   LEFT JOIN LATERAL (
     SELECT CASE t.name
              WHEN 'factory_repair' THEN 'factory_service'
              WHEN 'servicing'      THEN 'in_house_repairs'
              ELSE t.name END AS status,
            se.start_date AS since
     FROM asset_service_events se
     JOIN asset_service_event_types t ON t.id = se.event_type_id
     WHERE se.asset_id = a.id AND se.end_date IS NULL
       AND t.name IN ('factory_repair','servicing','transit',
                      'on_loan','field_test','missing')
     ORDER BY se.start_date DESC LIMIT 1
   ) se ON true;
   ```

   Index review (small tables today, but cheap to add):
   - `missions (glider_asset_id) WHERE recovery_date IS NULL`
   - `asset_service_events (asset_id) WHERE end_date IS NULL`
   - `asset_service_events (asset_id, event_type_id)` for the `destroyed` probe

5. **Data migration** — map existing glider `decommissioned` rows in
   `asset_status_history` → `assets.decommissioned_date` (use the row's
   `effective_date`), then see §7 for the per-glider backfill.

`current_asset_status` is left untouched — non-glider assets keep using it.

---

## 5. Gateway changes (this repo)

**Read path**

- `SELECT_FLEET` in `gateway/src/gliders/gliders.service.ts` — swap
  `current_asset_status` → `derived_asset_status`; add
  `a.decommissioned_date`, `a.decommission_reason`,
  `derived_asset_status.status_source`, `derived_asset_status.status_since`.
- `fetchStatusHistory` in `build.helpers.ts` — keep for the Timeline tab's
  history display; it now reads mostly as archived record for gliders.

**Write path — new**

- `ServicingService.SERVICING_EVENT_TYPES` →
  `["servicing","factory_repair","transit","on_loan","field_test","missing","destroyed"]`
- `recordEvent` — when `eventType === 'destroyed'`: inside the same
  transaction, `UPDATE assets SET decommissioned_date = $startDate,
  decommission_reason = 'destroyed' WHERE id = $assetId`, and close any open
  service event. Skip `assertNoOpenEvent`.
- New endpoint `PATCH /gliders/:id/decommission` (or fold into the servicing
  controller) → `{ decommissionedDate, reason }` → writes the two `assets`
  columns. `@Roles("editor","admin")`.
- New endpoint to reverse it (`decommissionedDate = NULL`) — "Return to
  service", for a mistake or a glider brought back.

**Write path — deleted**

- `PATCH /gliders/:id/status` route + `GlidersController.setStatus`
  + `GlidersService.setStatus` + `SetGliderStatusDto`
- `dashboard/src/app/api/gliders/[id]/status/route.ts`
- `setStatus("gliders", …)` branch in `api-client.ts` (keep the `"assets"`
  branch)

---

## 6. Frontend changes (this repo)

**Shared types (`types/src/index.ts`)**

- `AssetStatus` union — add `field_test`, `destroyed`.
- `Glider` — add `decommissionedDate: string | null`,
  `decommissionReason: string | null`,
  `statusSource: 'mission' | 'service_event' | 'default'`,
  `statusSince: string | null` (rename/keep alongside `statusEffectiveDate`).
- `ServicingEventTypeOption['name']` widens automatically via the seed.

**`lib/status-meta.ts`**

- `STATUS_LABEL` — `field_test: "Field test"`, `destroyed: "Destroyed"`.
- `STATUS_COLOR` — `field_test: "info"`, `destroyed: "error"`.

**`lib/timeline.ts`**

- `TimelineEventKind` — add `on_loan`, `field_test`, `missing`, `destroyed`.
- `KIND_META` — add entries (suggested):
  - `on_loan` — purple `#6a1b9a`
  - `field_test` — teal `#00838f`
  - `missing` — amber `#ff8f00`
  - `destroyed` — near-black `#37474f`, `cardStyle: "marker"`
- `GliderTimelineTab.buildTimelineEvents` / `servicingEventToTimelineEvent`
  already fold any `asset_service_events` type through `KIND_META`, so new
  types render with no further change.

**`AddServicingEventDialog`**

- Replace the flat `EVENT_TYPE_LABEL` map / single select with a grouped
  select or a small radio set:
  - *Servicing & activity* → servicing, factory_repair, transit, on_loan,
    field_test (span, end-date field shown)
  - *Went missing* → missing (span, end-date = "recovered on")
  - *Destroyed* → date + free-text "what happened", **no end date**, warning
    banner: "This retires {glider} from the active fleet."
  - *Decommission (no incident)* → date + reason select, **no title/end
    date**, same warning
- On save, "Destroyed" and "Decommission" call the new endpoints, not
  `recordServicingEvent`.

**`ServicingEventControls`**

- Button label / disabled logic: when a glider is decommissioned, the
  primary action becomes "Return to service"; the add-event button is
  hidden or disabled with a tooltip.

**`GlidersTable`**

- Remove the `status` column's `<StatusEditor>` — render a read-only chip
  from `STATUS_LABEL`/`STATUS_COLOR`, plus a small grey "Retired" chip when
  `decommissionedDate` is set. Tooltip: `status_since` + `status_source`
  ("Deployed since 3 Jun 2026 · mission GL_…").
- `showDecommissioned` filter → `g.decommissionedDate == null`.
- Status multi-select filter → derive options from the `AssetStatus` values
  actually present, not `statusOptions` ids.

**`gliders/[id]/page.tsx` + `GliderStatusBox`**

- Header chip: operational chip + "Retired" chip.
- `GliderStatusBox`: show the driving fact ("Factory service — since 12 May
  2026", "Deployed — mission GL_… since 3 Jun"), the retirement line
  ("Retired 2021-03-14 · destroyed") when set, and drop the old
  "previously X" line that read from `asset_status_history`.

---

## 7. Backfill

Small — the active fleet is ~7 gliders.

| Glider     | Action                                                                                             |
|------------|--------------------------------------------------------------------------------------------------|
| GNÅ        | `decommissioned_date` (from its old status-history row), `decommission_reason = 'end of life'`. No events → derives `Lab`. |
| SG562      | open `missing` service event (start = date contact lost) + `decommissioned_date` + `reason = 'lost at sea'`. Derives `Missing` + Retired. |
| SG561, URD | `destroyed` service event (start = incident date, details = "run over by vessel, …"). Auto-stamps `decommissioned_date` + `reason = 'destroyed'`. Derives `Destroyed` + Retired. |
| all active | audit query: any glider whose current dropdown value is `deployed` / `transit` / `in_house_repairs` / `factory_service` with **no** matching open mission or open service event → open the right event so the derived value matches on day one. |

Audit query sketch:

```sql
SELECT a.id, agd.glider_name, cas_name.name AS old_status, d.status AS derived
FROM assets a
JOIN asset_glider_details agd ON agd.asset_id = a.id
LEFT JOIN current_asset_status cas ON cas.asset_id = a.id
LEFT JOIN asset_status_options cas_name ON cas_name.id = cas.status_id
LEFT JOIN derived_asset_status d ON d.asset_id = a.id
WHERE a.decommissioned_date IS NULL
  AND cas_name.name IS DISTINCT FROM d.status;
```

### The script

Runnable version lives at `OGDB/scripts/backfill_derived_glider_status.sql`
(gitignored — the repo ignores `*.sql`; `git add -f` it if you want it
tracked). Fill in `actor_email` and the three incident dates at the top,
then:

```bash
cd ~/OGDB-portal && docker compose exec -T postgres psql -U ogdb -d ogdb \
  < backfill_derived_glider_status.sql
```

A guard aborts before the transaction if the placeholders aren't filled
in. The `missing` / `destroyed` INSERTs are skipped for a glider that
already has that event type, so a partial re-run is safe. Verified end to
end against ogdb-test (2026-09-03): SG561/URD → `destroyed` +
`decommissioned_date` moved to the incident date; SG562 → open `missing`
event, retirement date left as-is, reason `lost at sea`; GNÅ → reason
only. `freyja`, `odin`, `sg559`, `skuld`, `snotra` stay `Lab` + Retired
with no reason until someone fills in the optional block.

As of 2026-09-03 the audit query returns nothing on prod beyond the
expected `durin` (lab → deployed, a real open mission) — no stragglers to
fix.

---

## 8. Order of work

1. OGDB: columns + seed rows + view + indexes (one or more migrations),
   applied to `ogdb-test` first.
2. OGDB: data migration + manual backfill script for the 4 named gliders;
   run the audit query, fix stragglers.
3. Portal gateway: read path (`SELECT_FLEET`), then new write endpoints,
   then delete the old status path. Rebuild.
4. Portal types + `status-meta` + `timeline` constants.
5. Portal UI: `AddServicingEventDialog` branch → `GlidersTable` →
   detail page / `GliderStatusBox`.
6. Verify in the browser preview against the backfilled `ogdb-test`.
7. Deploy (see `deploy-target` memory — user runs the build step on NREC).

---

## 9. Open / deferred

- **Decommission endpoint** landed at `PATCH /assets/:id/decommission`
  (not `/gliders/:id/...` as first sketched) — the column is on `assets`
  and keeping it asset-level avoids a glider/asset branch in the shared
  `AddServicingEventDialog`. Gliders are the only asset type that
  surfaces it today.
- **A glider in the "All assets" table** (`SELECT_ASSETS`) still shows the
  manual `current_asset_status` value and an editable `StatusEditor`,
  which for gliders is now stale/inert. The fleet catalogue and glider
  detail page are authoritative. Fixing the generic table to fall back to
  `derived_asset_status` for glider-type rows is a small follow-up, left
  out to keep this change scoped.
- **Non-glider asset status** stays on the manual `asset_status_history`
  path. Deriving a sensor's status from its parent glider's state is a
  bigger question, out of scope here.
- **`asset_service_events.description` vs `decommission_reason`** — a
  `destroyed` event stores the free-text account in `description` and
  sets `decommission_reason = 'destroyed'` (a category, not the prose).
  Editing a destroyed event later does not re-sync `decommissioned_date`.
- **Status-transition audit** — if a full log of "when did it move Lab →
  Transit → Deployed" is wanted later, add trigger/service code that writes
  `asset_status_history` rows off mission/event open/close. Not needed for
  the display this plan delivers.
- **`asset_service_events` naming** — the table is now an asset
  activity/state timeline more than a "servicing" log. No rename planned;
  noting the semantic drift.
