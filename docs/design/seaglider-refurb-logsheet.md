# Seaglider refurbishment & preparation logsheet — field spec (DRAFT)

Source: `SG01 - Logsheet - Refurbment and Preparation-SG563d.xlsx` (v4.0, Rev E
glider, SG563, Oct–Nov 2025). This is a draft for review, not an implemented
design. Nothing here is built yet.

## Decisions so far

| # | Decision |
|---|---|
| 1 | A refurbishment is always tied to one mission (required FK). |
| 2 | Every entered value and every step records **who** and **when** (multiple techs work on one build). No single "Performed by". |
| 3 | Ballasting is a repeatable **tank run** (Run 1, 2, …). The tech marks one run as final. |
| 4 | Final trim values are saved **on the refurbishment record** (history, not overwritten on the glider), on tech sign-off. Earlier runs stay as record. |
| 5 | The 3-server gliderpage procedure is **one checkbox per server + link to the SOP**, not the commands. |
| 6 | **Field test** is an optional, repeatable section outside the main sequence. |
| 7 | **Cleared to deploy** sits at the top of the form; any team member can set it, but it is **blocked** until all required sections are complete. |
| 8 | Required for clearing: all sections except the field test; **sim dives and selftest are required**. Field test is optional. |
| 9 | A field test does **not** create an OGDB mission. It only stores a reference to its basestation mission. |
| 10 | Selftest log is parseable, so move metrics are parsed, not hand-keyed. |

## Field classes

- **DB** — reads from or writes to existing OGDB tables.
- **REC** — stored with the refurbishment record only, for later reference.
- **AUTO** — computed or pulled, never typed.
- **DROP** — remove from the form.

## Header (always visible)

| Field | Class | Notes |
|---|---|---|
| Glider SN | DB | Picked, not typed. |
| Mission | DB | Required. Gives site, deployment start and end dates. |
| Firmware | DB | From the glider record. |
| Installed sensors and batteries | AUTO | Derived from the mission's build (replaces the L18–L21 and D21–D23 formulas). |
| Revision (B or E) | AUTO | From glider details. Drives revision-specific items (magnetic wand vs shorting cable, `$SIM_PITCH`). |
| Cleared to deploy | DB | See below. |
| Estimated time, version history, `Sheet2` fleet table | DROP | Form version is tracked by the app. The fleet table duplicates OGDB. |

### Cleared to deploy

- Any team member may set it. The form stores who and when.
- **Proposal:** the control is shown at the top but disabled until every required section is complete, so it cannot be ticked while sections are open. If a section is edited afterwards, the flag is cleared and the record shows why.
- It is separate from the section ticks. It is the final "I have looked at the whole thing" step.
- Replaces "Data from this logsheet has been updated to OGDB" (no longer meaningful once the data is in OGDB).

## Sections, in proposed order

Each section records who completed it and when (AUTO). "Required" means it blocks
Cleared to deploy.

### A. Intake

| Field | Class | Notes |
|---|---|---|
| Previous mission issues | AUTO | Pulled from `asset_faults` and the previous mission's end cause. Tech can add notes (REC). |
| Old Argos tag: serial | DB | `argos_tag` asset. |
| Old Argos tag: tested, battery OK for another mission | REC | Pass/fail. |
| Old Argos tag: screenshot | DB | Upload to `documents`, attached to this refurb. Replaces the network path. |
| Old Argos tag: set to stop mode | REC | Checkbox. |

### B. External inspection (before opening)

Wings, rudder, outer fairing, antenna, sensors: condition (OK / needs work) and
note per item. Written as one `inspection` service event (REC, DB for the event).
"Describe repairs/damage" becomes the event note.

### C. Open and internal inspection

| Field | Class |
|---|---|
| Release vacuum, pitch battery aft before opening | REC (checkbox) |
| Forward hull: corrosion check, continuity | REC (condition + note) |
| Aft hull: corrosion check, continuity (the second "forward" on the old sheet is a typo for aft) | REC |
| Anode continuity, replaced? | REC; replacement is DB (service event) |
| Bulkhead connectors, cables, dummy connectors | REC |
| VBD bladder wear | REC |
| Port wiring map | **Move to glider build record**, not per refurb |

The old section 3 ("Open glider") only pointed to other sections and is dropped.

### D. Component changes while open

**Sensors** (old section 4). Repeating rows instead of fixed CTD / O2 / ECO rows.

| Field | Class | Notes |
|---|---|---|
| Sensor slot / type | DB | Picked from the glider's current assignments and the sensor catalogue. |
| Original serial | DB | Pre-filled from the mission build as it stood when the refurb started. |
| Replacement serial | DB | Swaps the item in the mission build. |
| Calibration date, cal required | DB | Calibration tables. |
| CT sail zero-frequency check | REC | Value + pass/fail. |
| Update coefficients on glider / basestation | REC | Checkboxes. |
| "Update sensors on Glider Status on Teams" | DROP | OGDB is the status. |

**Batteries** (old section 5).

| Field | Class | Notes |
|---|---|---|
| Old and new serial, position (primary 24 V, secondary 10 V) | DB | `asset_battery_details`, assignments. |
| Date of manufacture | DB | Typed as a date, not free text. |
| Mass (g), voltage (V) | DB | Battery measurements. |
| Capacity (Ah) | AUTO | From battery model. |
| Derating %, remaining % | AUTO | **Calculated once at install date.** The sheet's `TODAY()` formula changes every time it is opened. |
| Fuel gauge values (`$AH0_24V`, `$AH0_10V`) | AUTO + REC | Computed, shown for entry in pdos; checkbox for done. |
| "Update batteries on Teams" | DROP | |

**Other:** GPS board CR2450 coin cell (replaced?, date of manufacture; the old
"Voltage" cell holds a date, which is a data-entry slip) — REC.
Flash card backup done — REC (checkbox).

### E. Device tests

Rows shown **only for devices fitted to this glider** (not the hardcoded list).
Pass/fail + note per device: altimeter, compass, GPS, pressure sensor, and each
fitted science sensor. REC.

### F. Close and vacuum

| Field | Class |
|---|---|
| Cables checked by moving roll and pitch, o-rings cleaned/greased, glider closed, vacuum pulled | REC (checkboxes) |
| Internal pressure: initial, pulled, settled (psia, numeric) | REC; target 9 ±0.2 psia, flagged if outside |
| Relative humidity | REC |
| Anode continuity | REC |

Pressure is checked again before shipping (section I). The two readings are kept
as separate typed entries rather than a note in a checklist label.

### G. Tank test and ballast — repeatable runs

"Add another run" creates Run N. Each run holds:

| Field | Class |
|---|---|
| Date, entered-by | AUTO |
| Argos tag mounted or dummy weight used | REC |
| Weight in air (kg) | REC |
| Initial readings: pitch, roll, VBD, internal humidity, temperature, pressure (AD and engineering units) | REC |
| Roll: compass angle, AD counts, OK?, adjustment made | REC |
| Pitch: compass angle, AD counts, OK?, adjustment made | REC |
| Pitch gain: three battery positions, calculated gain (target 25–30, acceptable 20–50) | REC + AUTO |
| Tank temperature, salinity, density | REC |
| CT readings versus reference, per sensor fitted | REC |
| Target max density, desired and measured tank weight (±15 g), calculated difference | REC + AUTO |
| Ballast changes (what added or removed, grams) | REC |
| Free-text notes | REC |
| Marked as final run | DB trigger on sign-off |

**On tech sign-off of the final run** these are saved to the refurbishment record:
`$MASS`, volmax (calculated), roll/pitch/VBD centre values, and the ballast
weight added or removed. The glider page can show the latest signed-off values.

### H. Selftest

| Field | Class | Notes |
|---|---|---|
| Selftest number | REC | Links to the basestation record. |
| Result (PASSED / FAILED / ABORTED), warnings | REC | |
| Pitch, roll, VBD move metrics (distance, time, current, AD/s, errors) | AUTO (preferred) | Parse from the selftest log. Expected thresholds are fixed per revision and shown with automatic pass/fail. Fall back to manual entry only if parsing is not possible. |

### I. Software track (can run in parallel with hardware)

For each of **GLIDERS**, **GLIDER**, **GP** and the basestation home directory:

- One checkbox: "cleaned and archived after previous mission", with a link to the SOP. The sheet's shell commands move to the SOP.
- Repeated after sim dives and again before the mission (a repeatable checkbox group, not three copies of the text).

Then: confirm backup in `gliderbak`; sim-dive run (REC: cmdfile used, dives completed, plots OK, notes); mission files uploaded (science, cmdfile, targets, `sg_calib_constants.m`, others), `.pagers`, `.urls`, `.logout` verified.

### J. Final prep

| Field | Class |
|---|---|
| Internal pressure check (typed) | REC |
| Travel mode set, glider off | REC (checkbox) |
| **New** Argos tag: serial, PTT ID | DB |
| Tag: synced, config confirmed, test transmission, screenshot | REC + `documents` |
| Tag battery voltage (3.3–3.7 V), transmission count (below 30–40 k) | REC, flagged if outside range |
| Tag in auto-start mode | REC |
| Packing checklist (tag + clamps, comms cable, wand or shorting cable per revision, wings, rudder, cradle, spare kit, release mechanism, PC) | REC |
| "Update refurb notes / archive logsheet", "Update NorwegianMissions.xls", all "update … on Teams" | DROP |

### K. Field test (optional, repeatable)

| Field | Class | Notes |
|---|---|---|
| Date | REC | |
| Who | AUTO + REC | Logged-in user plus others present (several people may attend). |
| Vessel | REC | Free text or pick list if you keep one. |
| Description | REC | |
| Basestation mission | REC | Reference to the basestation mission (name or id). No OGDB mission is created. |
| Photos, files | DB | `documents`. |

## How this maps onto the database (proposed, not built)

- **New:** `refurbishments` (id, glider asset, mission FK, status, cleared_by, cleared_at, version of form), `refurb_step_entries` (generic: refurb id, section, field key, value, entered_by, entered_at) **or** per-section tables for the data-heavy sections.
- **New:** `refurb_tank_runs` (refurb id, run number, final flag, values above). Typed columns here, since these numbers will be compared across gliders.
- **Reuse:** the mission build (`mission_build_items`, edited through `POST /missions/:id/build-changes`) for sensor, battery and tag swaps, calibration tables, `asset_service_events` (inspection, refurb), `asset_faults`, `documents`, `missions`. See [mission-builds.md](mission-builds.md): builds belong to a mission, and `asset_assignments` is no longer read for glider builds.
- **Mission link:** a refurbishment attaches to the glider's `workshop` mission (or `scheduled` mission if no workshop exists). A workshop starts as a copy of the last flown build, so "original" sensors and batteries in section D are the workshop build as it stood, and "replacement" edits change that mission's build only.
- **Audit:** the existing audit-trigger pattern on `asset_assignments` suits per-entry authorship, so value history is not lost when someone corrects a number.

Design choice still open: a generic key/value entry table is quick to build and easy to change when the logsheet changes, but untyped. Typed tables are strict and queryable, but each logsheet change needs a migration. A reasonable split is typed columns for the DB-linked and tank-run values and key/value for checklist items.

## Resolved questions

1. Trim values live on the refurbishment record.
2. A field test creates no OGDB mission.
3. Cleared to deploy is blocked until required sections are complete.
4. The selftest log is parseable.
5. Field test optional; sim dives and selftest required.

## Still open

1. Where the form starts (glider page, mission tab, or list page).
2. Whether the header's "SN" is the glider's `serialNumber` field and how `SG563` is stored.
3. Exact format of the selftest log, to write the parser.
