# Colour strategy for chips

**Status (2026-11-26):** implemented. The single source is
`dashboard/src/lib/chip-style.ts`; states use `statusChipProps()` in
`lib/status-meta.ts`, mission statuses use `missionStatusChipProps()`. Change a
colour THERE, never at a call site. Typechecks; not yet looked at in a browser.

A colour means the same thing everywhere. There are seven roles.

| Role | Colour | Means | Chips |
|---|---|---|---|
| **go** | green | operating now, or a good outcome | **Deployed** (glider / asset state) · **Active** (mission) · Normal (cause of ending) · Pass · Saved · Signed off · Closed (RMA) · best (data file) · On mission (Iridium) · Ready to clear for deployment |
| **lined** | blue | lined up, or away but fine | Ready to deploy · Scheduled · Transit · On loan · Field test · RMA in progress · Replaced (sensors) |
| **work** | amber | being worked on / waiting on someone | Being prepared (glider) · Workshop (mission) · In-house repairs · Factory repairs · Pre-mission service · Open RMA · Open event · Unsaved · "n still open" · pre-deployment / left on (Iridium) · Medium severity |
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

## Glider state, mission lifecycle and tags (2026-11-26)

Three groups of tags, kept deliberately separate so one word never means two
things:

| Group | One at a time? | Values (colour) |
|---|---|---|
| **Glider state** (derived, filled) | yes | Destroyed (slate) > Missing (red) > Deployed (green) > In-house repairs / **Factory repairs** (amber), Transit / On loan / Field test (blue) > Ready to deploy (blue) > **Being prepared** (amber) > Idle (grey) |
| **Mission lifecycle** (stored, filled) | yes | Workshop (amber) -> Scheduled (blue) -> Active (green) -> **Ended** (grey outline) |
| **Cause of ending** (only once Ended) | yes | **Normal** (green: voluntary recovery) · a loss or damage (red: hit by ship, vandalized, leak, beached…) · a technical fault (amber: battery, telemetry, ballast…) · administrative or unknown (grey) |
| **Tags** | stack | Decommissioned (grey outline) · Servicing required (red, filled) |
| **Location** (only when known) | one | grey outline, shown only when the glider is not at sea, missing or destroyed |

Decisions:
- The glider state "Workshop" is now **Being prepared**, so the word "Workshop"
  means the mission stage only. The mission lifecycle keeps **Workshop**.
- "Factory service" is now **Factory repairs** (glider state, timeline kind and
  event label).
- **There is no Scheduled tag on a glider.** Scheduled is a mission lifecycle
  stage only.
- The mission status "Recovered" is shown as **Ended**; the stored status is
  unchanged (recovered, killed in action, missing in action and discontinued all
  read "Ended", and the cause says how). "Voluntary recovery of the platform" is
  shortened to **Normal**.
- The old mission statuses *factory service*, *lab service* and *transit* describe
  the glider, so they are hidden from the status dropdown. The rows stay in the
  database.
