# Colour strategy for chips

**Status (2026-11-26):** implemented. The single source is
`dashboard/src/lib/chip-style.ts`; states use `statusChipProps()` in
`lib/status-meta.ts`, mission statuses use `missionStatusChipProps()`. Change a
colour THERE, never at a call site. Typechecks; not yet looked at in a browser.

A colour means the same thing everywhere. There are seven roles.

| Role | Colour | Means | Chips |
|---|---|---|---|
| **go** | green | operating now, or a good outcome | **Deployed** (glider / asset state) · **Active** (mission) · Pass · Saved · Signed off · Closed (RMA) · best (data file) · On mission (Iridium) · Ready to clear for deployment |
| **lined** | blue | lined up, or away but fine | Ready to deploy · Scheduled · Transit · On loan · Field test · RMA in progress · Replaced (sensors) |
| **work** | amber | being worked on / waiting on someone | Workshop · In-house repairs · Factory service · Pre-mission service · Open RMA · Open event · Unsaved · "n still open" · pre-deployment / left on (Iridium) · Medium severity |
| **problem** | red | needs action, or must not be used | **Servicing required** · Missing · Missing in action · Fail · High / critical severity · RMA shipping issue · Open (a servicing-required or missing event) |
| **ended** | dark slate | finished, nothing more to do | Destroyed · Killed in action |
| **inactive** | light grey | out of play, or neutral | Idle · Lab · Decommissioned · Discontinued · Status not set · Low severity · plain labels (event kinds, "Notes") |
| **brand** | teal | the app's own accent: selection, BETA | BETA · selected filter chip · Final run. **Never a status.** |

## Filled vs outlined

- **Filled** = what something *is now* (a state).
- **Outlined** = a *tag* or a *finished record*: Scheduled, Decommissioned, and a
  **Recovered** mission (green outline: a completed record, not live).
- The one tag that is also filled: **Servicing required**. It has to be loud.

## Where the old colours changed

| Was | Now | Why |
|---|---|---|
| Destroyed: red | dark slate | red is kept for "act on this"; nothing can be done about a destroyed glider |
| Killed in action (mission): red | dark slate | same |
| Recovered mission: filled green | outlined green | filled green now means live |
| Scheduled mission: amber | blue | "lined up", matching the Scheduled tag |
| Workshop mission: blue | amber | matches the Workshop state |
| Ready to deploy: blue | blue | unchanged; green is kept for "in the water" |
| "On mission" (Iridium): teal | green | in the water |
| Open event: always amber | red for servicing-required / missing | those are problems, not ordinary work |
| Missions table row tint: scheduled orange | blue | same role as the chip |

## Timeline palette (hex, per event kind)

The timeline needs each kind told apart on one chart, so related kinds differ in
*shade* within a family rather than share one colour. The families follow the
roles above.

| Kind | Colour | Family |
|---|---|---|
| Mission | `#2e7d32` green | go |
| Servicing required | `#c62828` red | problem |
| Missing | `#e53935` lighter red | problem |
| In-house servicing / Pre-mission service | `#f57c00` orange | work |
| Factory servicing / RMA case | `#bf360c` deep orange | work |
| Transit | `#0288d1` light blue | lined |
| On loan | `#3949ab` indigo | lined |
| Field test | `#00838f` teal-cyan | lined |
| Destroyed | `#37474f` dark slate | ended |
| Calibration | `#f9a825` yellow | (a measurement, not a status) |

Before, factory servicing and RMA cases were red; that would now read as
"problem", so they are deep orange.

## Not changed

The refurbishment logsheet's section progress already follows the scheme (done
green, in progress amber, not started grey). Table row tints use the same colours
via `ROLE_TINT`.
