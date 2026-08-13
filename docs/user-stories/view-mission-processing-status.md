# View data processing status

## User story

As a researcher or engineer, I want to see a mission's data processing status —
what's been done, by whom, when, and with which processing package version —
on that mission's page, so that I don't have to ask around to find out what
data exists and what's been done to it.

## Acceptance criteria

1. Clicking a mission row in the missions list navigates to that mission's
   detail page.
2. The page has a **processing status table** with one row each for:
   *raw data archived*, *L0*, *L1 (timeseries)*, *L2 (gridded)*.
3. Each row shows a tick for done/present, **who**, **when**, and
   **processing package version** (linked to the specific release used). For
   "raw data archived", version is typically blank — it's a manual transfer,
   not a software run.
4. A **download** button lets the user pull the file(s) from the local
   filesystem. (THREDDS deferred to a later story.)
5. The page shows external references: **DOI** + archive link, **Ocean-OPS**
   board link, **Coriolis** link — each displayed as "not yet available" when
   unset.

## Out of scope (separate stories)

- Editing any field on this page.
- QC / manual-QC notes (pending Ailin's input).
- THREDDS-based downloads.
- Cross-mission "what's outstanding" triage view.

## Dependencies

- None of the processing-status fields (raw archived, L0/L1/L2 status,
  who/when/version) or external-reference fields (DOI, Ocean-OPS, Coriolis)
  exist in the DB yet — schema work is a prerequisite.
- For v1, these fields are populated directly in the DB (no editing UI); an
  edit story will replace that later.

## Wireframe

Placeholder values below are illustrative only.

```
Missions > SG-0042-Mission-14                              [ recovered ]

Glider: SG-0042   Site: Norwegian Sea   Launch: 2026-02-14   Recovery: 2026-03-09

Processing status
+--------------------+--------+----------+------------+----------+----------+
| Stage              | Status | Who      | When       | Version  | Download |
+--------------------+--------+----------+------------+----------+----------+
| Raw data archived  |   ✓    | K.Nilsen | 2026-03-10 |    —     |          |
| L0                 |   ✓    | pyglider | 2026-03-11 | v0.6.2 ↗ |    ⬇     |
| L1 (timeseries)     |   ✓    | pyglider | 2026-03-11 | v0.6.2 ↗ |    ⬇     |
| L2 (gridded)       |   –    |    —     |     —      |    —     |  ⬇(off)  |
+--------------------+--------+----------+------------+----------+----------+

External references
  DOI              not yet available
  Ocean-OPS board  view record ↗
  Coriolis         not yet available
```

Layout notes:
- Mission header (breadcrumb, name, status badge) and a small metadata row
  (glider, site, launch/recovery dates) sit above the processing table.
- Processing status is a plain table, not a checklist widget — one row per
  stage, consistent columns.
- External references render as a simple label/value list, with an explicit
  "not yet available" state rather than a broken or empty link.
