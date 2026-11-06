# Mission builds

How a glider's configuration is stored. Replaces the "live build +
back-dated assignments" model.

## The problem it fixes

`asset_assignments` stored two different facts in one row:

- **state** -- "this CT sensor is installed on Durin from date A to date B"
- **membership** -- "this CT sensor was part of Durin's setup for mission 40"

The mission page and the glider page edited the same rows, so a change meant
for one mission leaked into the glider's live build (and could produce
`end_date < start_date`). Membership has no honest dates -- the lab often
records a build long after the mission -- so it now has none.

## The model

- **Every build belongs to a mission.** `mission_build_items` has one row per
  asset per mission: `(mission_id, asset_id, parent_item_id, position)`.
  No dates.
- **`parent_item_id`** is a self-reference (NULL = mounted directly on the
  glider). The composite FK `(mission_id, parent_item_id) -> (mission_id, id)`
  makes it impossible to hang a sensor under a payload bay that is not part of
  the *same* mission's build. `ON DELETE CASCADE` removes a part's children.
- **The Slocum aft section** is stored as an ordinary item, so a mission's
  build is complete on its own. It is the glider's identity and is never
  added, replaced or removed by hand.
- **No separate "current build".** The glider page shows a read-only
  **Last flown build**: the build of the last mission that launched.

## Mission lifecycle

```
workshop -> scheduled -> active -> recovered
            scheduled -> active            (workshop is optional)
```

| Status      | Meaning                                              | Must have                          |
|-------------|------------------------------------------------------|------------------------------------|
| `workshop`  | Glider being prepared. Only the glider is known.     | glider                             |
| `scheduled` | The glider has been assigned a mission.              | + project, site                    |
| `active`+   | At sea / done.                                       | + launch date                      |

Enforced in `MissionsService.assertFieldsForStatus` (gateway), not the DB.

- A workshop is created from the glider page ("Start workshop") and starts as a
  **copy of the last flown build**. One workshop per glider (partial unique
  index).
- **`mission_number`** is the permanent facility-wide identifier (the `NNN-`
  data-folder prefix). It is NULL until the mission is past planning, then
  assigned once (`max + 1`, under an advisory lock). A trigger forbids changing
  it afterwards and requires it on every non-workshop/scheduled mission.
- A workshop is not listed in mission lists, the map, or the summary stats, and
  is ignored by `derived_asset_status` (it can never make a glider read as
  `deployed`). OGDP selects missions by explicit number, so it never sees one.

## Editing

- A mission's build is edited **only on its mission page**, at any status
  (the lab catches up on records after the fact). An edit cannot touch another
  mission or the glider's history.
- **Copy build from...** replaces a mission's build with a copy of another
  mission of the same glider.
- **Overlaps.** An asset in two *open* builds (active / scheduled / workshop) of
  *different* gliders gets a warning. Two **active** builds claiming one asset is
  refused. Same-glider missions are ignored: a workshop shares everything with
  the last build by design.

## What stays where

- Service events, calibrations, status history and RMAs are unchanged.
- `asset_assignments` is no longer read for glider builds. It remains as
  history until a later migration drops it.
- "Where is asset X?" = the most advanced open mission build that lists it
  (active, then scheduled/workshop, then last flown); an open service event
  overrides it. "Not installed" = in no open build.

## Migrations (OGDB repo)

1. `xxxx_mission_build_items` -- table, `workshop` status, nullable
   `mission_number` + triggers, one-workshop-per-glider index, view fix.
2. `xxxx_mission_build_items_backfill` -- copies each mission's as-of-launch
   build; creates a workshop for any glider (not retired, no active mission)
   whose live build differs from its last mission's.

Run `scripts/preview_mission_build_backfill.sql` first: read-only, lists every
mission as "N items" or "NOT RECORDED", and every glider's planned action.
