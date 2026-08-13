# View glider information — About Glider

## User story

As an engineer (workshop or piloting), I want to see everything the database
holds about a specific glider on one page, so that I can make servicing
decisions and check calibration status without digging through the database
myself.

## Acceptance criteria

1. A glider detail page exists for every glider, titled "Glider: {name}".
2. The page shows three quick-look boxes: **About Glider**, **Current
   Build**, **Status**. Current Build and Status render as "coming soon"
   placeholders in v1.
3. **About Glider** is fully populated with: WMO, nickname, serial number,
   platform maker, platform model, transmission system, owner, year
   purchased.
4. Below the quick-look boxes, collapsible sections exist for Platform
   Information, Science Payload, Servicing History, Editing History —
   structurally present but not populated in this story.

## Out of scope (separate stories)

- Populating Current Build and Status boxes.
- Platform Information, Science Payload, Servicing History, Editing History
  section content.
- Linking build components to their own asset pages.
- Sensor calibration display (deferred to the Science Payload story;
  calibration dates confirmed to live under the Sensors heading there).

## Dependencies

- Transmission system, owner, and year-purchased fields don't exist in the
  current gateway/API ([gliders.service.ts](../../gateway/src/gliders/gliders.service.ts))
  — need schema verification and likely new columns.
- Platform maker/model split needs verification against the live `platforms`
  table (currently only a single combined `platform` name is exposed).

## Notes for follow-on stories

- Layout pattern: non-collapsible quick-look boxes up top for fast
  scanning (serves both workshop and piloting use), collapsible detail
  sections below for deep dives — same pattern used in the mission
  processing status page.
- Science Payload section (future story) needs a calibration status/due-date
  field under its Sensors heading, not just sensor identity.
- Servicing history and Editing history are two distinct tables (physical
  maintenance/repair/calibration events vs. DB field change log) — do not
  merge them.
