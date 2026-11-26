# Servicing required ("do not deploy")

**Status (2026-11-26):** built and applied to `ogdb-test`; migration not on prod.
Gateway tested (24 checks, rolled-back transaction). UI typechecks; not yet
looked at in a browser by the author.

Some assets need serious repair (major in-house work or a factory repair) and
must not be deployed until it is done. This records that as a **timeline event**
and shows it as a **red "Servicing required" chip** everywhere the asset appears,
plus a list on the home page.

It is separate from the **Wear watch** on the home page, which is about days in
the water since the last service. A flag is a deliberate "this is broken";
wear is a threshold that is crossed.

## Model

- A new `asset_service_event_types` row, `servicing_required`
  (`OGDB/alembic/versions/xxxx_servicing_required_event_type.py`). Applies to any
  asset, not just gliders.
- **Open** (`end_date IS NULL`) = flagged. **Resolving** sets the end date; the
  chip goes away but the event **stays on the timeline** as a closed span (what
  was wrong, when it was raised, when it was fixed). It is never deleted by
  resolving.
- It is a **flag, not a state**:
  - `derived_asset_status` only looks at an explicit list of event types, so it
    ignores this one -- a flagged glider's state is unchanged.
  - It coexists with other open events (a glider can be in transit AND need
    servicing), so it is left out of the one-open-event rule in both directions.
  - **One open flag per asset** (a partial unique index, plus a friendly check in
    the service). A second would only be noise: edit or resolve the first.
- Decommissioned assets are left off the home-page list (nothing to fix).

## What "do not deploy" does

1. **Shown:** red chip on the glider header, asset header, battery header; a
   read-only chip in the fleet table and All assets table.
2. **Withdraws "cleared to deploy":** raising a flag on a glider, or on a
   component in an open (workshop / scheduled) build, withdraws that build's
   logsheet clearance, logged as an `unlocked` row ("Servicing required raised")
   -- the same treatment as editing the build.
3. **Blocks clearing:** `RefurbishmentsService.clear` refuses while the glider or
   anything in its build is flagged, naming what and why.
4. **Warns on the build:** the mission's build warnings (the persistent list and
   the "Warning:" lines after a save) include
   "`<asset>` is flagged servicing required (do not deploy): `<title>`".

It does **not** block deploying a mission directly (setting a deployment date):
the clearance gate is the enforcement point.

## Using it

- **Raise:** glider -> **Log -> Condition -> Servicing required…**; other assets
  -> **Add event -> Servicing required**. Give a short title ("what's wrong") and
  describe what needs doing. There is no end date while raising it.
- **Resolve:** click the **✕** on the red chip (or Log -> Resolve servicing
  required…, or **Resolve** on the home-page row). Pick the date (not before it
  was raised, not in the future) and optionally what was done, which is appended
  to the description as "Resolved: …". Editing the event and entering a
  "Resolved on" date does the same.
- Resolving does **not** restore "cleared to deploy": the logsheet needs clearing
  again.
- A mistaken flag can be deleted like any event (Edit -> Delete event).

## Home page

A **Servicing required** section (between Workshop status and RMAs): asset,
serial number, what needs doing (title + two lines of the description), flagged
date and days, and a Resolve button for editors. Rows open the asset.

## API

- `GET /assets/servicing-required` -- every open flag (decommissioned assets
  excluded). Pages fetch the list and pick out what they need.
- `POST /assets/:id/servicing/:eventId/resolve` `{ date?, note? }` (editors).
- Raising and editing use the existing servicing-event endpoints with
  `eventType: "servicing_required"`.

## Open question

Whether the clearance guard (3) should stay a hard block or become advisory
(warning only). It is a hard block now because "do not deploy" without any
enforcement is just a label; it is one `if` in `RefurbishmentsService.clear`.
