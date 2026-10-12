# Mission data bundle — spec

Status: **draft for review** (2026-10-12; builder location and input decided). Contract between the portal's mission
data UI (`docs/wireframes/mission-data-mockup.html`) and the code that feeds it.
The UI is built against this document; the bundle builder and the gateway
endpoints are built against it too. Change it here first, then in code.

---

## 1. Why a bundle, and not ERDDAP directly

The mission data page is an investigation workspace for a **whole mission at
once**: stacked sections with linked zoom, map + profile hover, T–S diagram,
statistics, 3D view, staff QC. Everything is hover/zoom-interactive, so the
browser needs the mission's display data **in memory**.

Measured on mission 023 (a typical reprocessed Seaglider L2):

| Form | One variable | 33 profile×depth variables |
|---|---|---|
| L2 NetCDF as stored (1634 profiles × 1006 × 1 m) | 6.6 MB | 217 MB |
| ERDDAP JSON (what the browser would get from ERDDAP) | 70 MB | — |
| **Bundle: 5 m grid, int16, gzip** | **0.58 MB** | ~9 MB for 15 variables |

And ERDDAP can't be called from the portal's pages anyway: it's plain HTTP
(the portal is HTTPS → mixed content) and sends no CORS headers.

So the roles are split:

- **ERDDAP** = the official, citable, full-resolution copy. The page's "Open in
  ERDDAP ↗" and "Download" go there (`dataset_processing.erddap_l2_url`).
- **The bundle** = a per-mission, display-ready derivative made for this UI:
  regridded to 5 m, 16-bit, one array per variable, standard variable names,
  derived products precomputed, staff-only data separated.
- **Full detail on demand**: a single pinned profile at full 1 m resolution
  comes from ERDDAP through the gateway (§8.3) — ~1000 rows, cheap.

The bundle is built from **the same L2 NetCDF that is live on ERDDAP** for the
mission (read from `/Data`, not downloaded), so the plots and the page's
ERDDAP/Download buttons always show the same data.

```
/Data L2 NetCDF (the file live on ERDDAP) ──(bundle builder, on a lab machine)──▶ public.zarr + staff.zarr
                                                            │ upload (editor login)
                                                            ▼
Browser ◀──HTTPS, same site── gateway (nrec_app): serves bundle files ──▶ ERDDAP (one profile on demand)
```

---

## 2. Format: Zarr v3

- **Zarr v3** stores (directory per store; `zarr.json` metadata files + one
  chunk file per array). Open format, standard in ocean/climate data (Pangeo);
  Python writes it from xarray, the same store opens in Python for checking.
- Browser reads it with **`zarrita`** (MIT): fetches only the arrays asked for.
- **Codec: `gzip` only.** zarrita decodes it with the browser's built-in
  `DecompressionStream` — no WASM codec bundle. (Not blosc/zstd.)
- **One chunk per array** (whole array = one file). Sizes are small enough
  (≤ ~1 MB per variable) that per-variable granularity is what matters, not
  sub-array chunks. If a mission ever exceeds ~3000 profiles, chunk along
  `profile` in blocks of 1000 — the reader code must not assume one chunk.

### 2.1 Two stores per mission

| Store | Who can read it | Contents |
|---|---|---|
| `public.zarr` | anyone who can see the mission page | coordinates, public variables, derived products |
| `staff.zarr` | staff (portal role editor/admin) | raw & engineering variables, QC availability matrix |

Same dimensions and coordinates in both (`staff.zarr` repeats the coordinate
arrays, so it's self-contained). Separate stores — not a per-variable flag —
so access control is a whole-path check in the gateway (§8.2).

---

## 3. Dimensions and coordinates

| Dimension | Meaning |
|---|---|
| `profile` | one cast. Seaglider "Up and Down" L2 files hold down and up casts as alternate records, so a dive is two profiles |
| `level` | depth bin, 5 m: centres 2.5, 7.5, … down to the mission's deepest bin with data |
| `sensor` | (staff store only) one entry per variable in the availability matrix |

Coordinate arrays (in both stores):

| Array | dims | dtype | Notes |
|---|---|---|---|
| `time` | profile | float64 | seconds since 1970-01-01T00:00:00Z, the profile's own time (L2 `time`) |
| `latitude`, `longitude` | profile | float32 | degrees_north / degrees_east |
| `dive` | profile | int32 | dive number (shared by a dive's down and up cast) |
| `cast` | profile | int8 | **0 = descent, 1 = ascent.** Up-and-down files alternate records (index even = down); the builder verifies the pairing against `dive_number`/`depth_avg_curr` and stores −1 if it can't tell. (Solves the mockup's "ascent vs descent not available" note.) |
| `distance_km` | profile | float32 | cumulative great-circle distance along the profile positions — the mockup's "Distance" x-axis |
| `depth` | level | float32 | bin centre, metres, positive down |
| `depth_bounds` | level, 2 | float32 | bin edges |

Profiles are in time order. Positions/times with no valid value are NaN.

---

## 4. Variables — standard names

The builder maps each file's own variable names onto **one standard set**, so
the UI never sees per-mission or per-file-layout differences (e.g. the older
001–011 files call temperature `temp`). Each array records where it came from
in its attributes (`source_variable`, `source_units`).

All profile×level arrays: dims `(profile, level)`, int16 packed (§5).

### 4.1 Public (`public.zarr`)

| Group (mockup chip) | Standard name | Units | From (first found) | Present in |
|---|---|---|---|---|
| Core CTD | `temperature` | degree_C | `temperature`, `temp` | 48/48 |
| Core CTD | `salinity` | 1e-3 (PSS-78) | `salinity` | 48/48 |
| Core CTD | `pressure` | dbar | `pressure` | 48/48 |
| Core CTD | `conductivity` | S/m | `conductivity` | where present |
| Core CTD | `conservative_temperature` | degree_C | **computed** (TEOS-10, `gsw`) | all with T, S |
| Core CTD | `absolute_salinity` | g/kg | **computed** (TEOS-10) | all with T, S |
| Core CTD | `sigma0` | kg/m³ | **computed** (TEOS-10 σ₀ — the "sigma_theta" in the mockup) | all with T, S |
| Core CTD | `sound_velocity` | m/s | `sound_velocity`, `soundvel`; else computed (TEOS-10) | all |
| Oxygen | `oxygen` | µmol/kg | `aanderaa4330_dissolved_oxygen`, `aanderaa4831_dissolved_oxygen`, `contopt_dissolved_oxygen` | ~30/48 |
| Oxygen | `oxygen_saturation_concentration` | µmol/kg | `dissolved_oxygen_sat` (this is the saturation *concentration*, not %) | 40/48 |
| Oxygen | `oxygen_saturation` | % | **computed**: 100 × `oxygen` / `oxygen_saturation_concentration` | where both |
| Optics | `chlorophyll` | µg/L | `wlbb2fl_sig695nm_adjusted` | 6/48 |
| Optics | `backscatter_700` | m⁻¹ sr⁻¹ | `wlbb2fl_sig700nm_adjusted` | 6/48 |
| Optics | `backscatter_470` | m⁻¹ sr⁻¹ | `wlbb2fl_sig470nm_adjusted` | 6/48 |

Per-profile (dims `profile`, float32):

| Group | Standard name | Units | From |
|---|---|---|---|
| Currents | `dac_east`, `dac_north` | m/s | `depth_avg_curr_east/north`, `u_da/v_da` (both casts of a dive carry the dive's value) |

**Why computed density fields:** σθ/σ₀, θ and CT exist in only 33 or 15 of the
48 files, from different software versions. Computing them for every mission
with TEOS-10 (`gsw`, open source) from the gridded T, S, p makes isopycnal
overlays and T–S diagrams comparable across missions. The source file's own
versions, where present, go to `staff.zarr` for comparison.

Arrays that don't exist for a mission are simply absent; the UI lists what's
there (§7).

### 4.2 Staff only (`staff.zarr`)

| Standard name | From |
|---|---|
| `temperature_raw`, `salinity_raw`, `conductivity_raw` | same names |
| `source_sigma_theta`, `source_theta`, `source_density` | the file's own `sigma_theta`/`sigma_t`, `theta`, `density` — to compare with the computed ones |
| `eng/<name>` | every `eng_*` variable on profile×depth, name without the `eng_` prefix (e.g. `eng/aa4330_O2`, `eng/pitchAng`) |
| `glider_speed`, `glider_vertical_speed`, `glider_horizontal_speed` | `speed`, `vert_speed`, `horz_speed` |
| `availability` | see §6.4 |

---

## 5. Encoding

- Profile×level science arrays: **int16** with CF packing in the array
  attributes: `scale_factor`, `add_offset`, `_FillValue = -32768` (= missing).
  Value = stored × `scale_factor` + `add_offset`. The builder picks
  scale/offset per array from the mission's min/max (2 % margin), so precision
  is range/65534 — e.g. 0.0002 °C for temperature.
- Coordinates and per-profile arrays: float32 (float64 for `time`), NaN = missing.
- Gridding: mean of the source 1 m bins inside each 5 m bin (older layout
  files are already 5 m — taken as is, re-labelled to the same bin centres).
  A bin with no valid source value is missing. **No gap filling in the
  bundle** — the mockup's "gap-filled cells" overlay needs its own mask if
  interpolation is ever added (an open decision, §11).

---

## 6. Precomputed products (`public.zarr` unless noted)

Things the browser shouldn't compute over ~300k cells on every interaction.

### 6.1 Statistics — mockup "Mean profile, 5–95 %, Min/max"
`stats/<variable>/{mean,p05,p95,min,max,count}`, dims `level`, float32
(`count` int32). Over all profiles of the mission (both casts).

### 6.2 Mixed layer depth — overlay
`mld`, dims `profile`, float32, metres. σ₀ threshold 0.03 kg/m³ relative to
the value at 10 m (de Boyer Montégut et al. 2004). Method and threshold in the
array's attributes.

### 6.3 Thermocline — overlay
`thermocline_depth`, dims `profile`, float32: depth of the maximum
−∂T/∂z below the mixed layer, on the 5 m grid, after a 3-bin running mean.

### 6.4 Data availability — staff QC tab (`staff.zarr`)
`availability`, dims `(sensor, dive)`, uint8 = % of the dive's bins with a
valid value (both casts together); `sensor` coordinate holds the standard
names. Plus `dive_index`, dims `dive`, int32 = dive numbers.

### 6.5 Computed in the browser (deliberately not stored)
Isopycnal contours (from `sigma0`), dive-to-dive differences, T–S colouring,
variable-vs-variable scatter — all cheap once the arrays are loaded, and they
depend on the user's choices.

### 6.6 Bathymetry — not in the bundle
The 3D view's surface comes from GEBCO/EMODnet tiles, fetched separately.

---

## 7. Root metadata (`public.zarr/zarr.json` attributes)

```json
{
  "bundle_format_version": 1,
  "mission_number": 23,
  "mission_name": "sg561_provolo_lofoten_may2016",
  "ogdb_mission_id": 23,
  "source": {
    "processing_run_id": 45,
    "stage": "AUTO_QC",
    "l2_file": "naco/data/delayed/023-.../reprocessed_bs3/..._up_and_down_profile.nc",
    "file_layout": "L2_new"
  },
  "erddap_l2_url": "http://158.39.77.95/erddap/tabledap/sg561_provolo_lofoten_may2016_l2.html",
  "grid": { "bin_m": 5, "n_profile": 1634, "n_level": 201 },
  "variables": [
    { "name": "temperature", "group": "Core CTD", "units": "degree_C",
      "long_name": "Sea water temperature", "valid_min": -1.8, "valid_max": 12.4,
      "source_variable": "temperature", "computed": false }
  ],
  "built_at": "2026-10-12T14:00:00Z",
  "builder_version": "0.1.0",
  "licence": "CC BY 4.0",
  "citation": "University of Bergen Ocean Glider Facility"
}
```

`variables` is what drives the mockup's "Variables ▾" menu: one entry per
array actually present, with its group. `valid_min/max` are the mission's
actual range (sensible colour-scale defaults). `staff.zarr` has the same keys
for its own variables.

**Staleness:** `source.processing_run_id` is compared by the gateway with the
processing run of the L2 file **currently live on ERDDAP** (OGDB
`current_erddap_status.processing_run_id` for level L2). If they differ, the
ERDDAP file has been replaced since the bundle was built — the API reports
`stale: true` and the page can say "newer data exists, rebuild pending".
(Compared with the live ERDDAP file, not the mission's best file: between an
OGDB ingest and the next ERDDAP push the two can differ, and the bundle must
match what ERDDAP serves.)

---

## 8. Gateway API (OGDB-portal)

All under the existing `/missions/:id` routes; same login/roles as the rest of
the portal. Mission `:id` = `missions.id` (as the rest of the portal API).

**How the browser reaches these:** the gateway is not public (it listens on
`nrec_app`'s loopback only). The browser calls the dashboard's own Next.js
route handlers under `/api/...`, which forward to the gateway with the
session token — the existing pattern (e.g.
`dashboard/src/app/api/datasets/[missionId]/references/route.ts`). The bundle
needs one more of those: a catch-all
`dashboard/src/app/api/missions/[id]/bundle/[...path]/route.ts` that
**streams the response body as bytes** and passes `ETag` / `Cache-Control` /
`Content-Type` through. ⚠️ The existing handlers read responses with
`res.text()` — that corrupts binary Zarr chunks; this one must pass
`res.body` through unchanged. Paths below are the gateway's; the browser uses
the same path prefixed with `/api`.

### 8.1 `GET /missions/:id/bundle` → summary

```ts
interface MissionBundleSummary {
  available: boolean;            // false: no bundle built yet
  stale: boolean;                // built from an older file than the L2 now live on ERDDAP
  builtAt: string | null;
  publicStoreUrl: string | null; // "/api/missions/23/bundle/public.zarr" (dashboard route, see above)
  staffStoreUrl: string | null;  // null unless the caller is editor/admin
  erddapL2Url: string | null;
}
```

### 8.2 `GET /missions/:id/bundle/{public|staff}.zarr/<path>` → store files

Static files of the store (`zarr.json`, chunk files) — exactly what zarrita's
`FetchStore` requests. `staff.zarr` returns 403 for non-staff. Responses carry
`ETag` and `Cache-Control: private, max-age=3600` (files only change when a
new bundle is uploaded, which changes the build directory — see §9), so a
second visit loads from the browser cache.

### 8.3 `GET /missions/:id/profiles/:profile?variables=temperature,salinity` → one full-resolution profile

Proxied from ERDDAP (gateway → `nrec_erddap` over the internal network, ~4 ms),
using the frozen dataset id from `erddap_l2_url`, for the pinned-dive detail
view. `:profile` is the bundle's profile index; the gateway turns it into a
time constraint. Variables use the **ERDDAP names** of that dataset (the
bundle's `source_variable` attributes give the mapping).

```ts
interface FullResolutionProfile {
  profileIndex: number;
  time: string;
  depth: number[];                       // 1 m bins
  values: Record<string, (number | null)[]>;
  units: Record<string, string>;
}
```

### 8.4 `PUT /missions/:id/bundle` (editor/admin) → upload

Body: one `.zip` with `public.zarr/` and `staff.zarr/` at its root. The
gateway validates (`bundle_format_version`, mission number matches `:id`),
unpacks into a new build directory, then switches the mission's "current"
pointer to it and deletes the previous build — so a reader never sees half a
bundle.

**Storage** — on the portal VM (`nrec_app`), in the portal's own file storage,
the same way uploaded documents are kept:

| | Documents (today) | Bundles (new) |
|---|---|---|
| In the gateway container | `/app/storage/documents` (`DOCUMENTS_DIR`) | `/app/storage/bundles` (`BUNDLES_DIR`) |
| Docker volume (`docker-compose.yml`) | `documents_data` | `bundles_data` (new) |
| On `nrec_app`'s disk | `/var/lib/docker/volumes/ogdb-portal_documents_data/_data` | `/var/lib/docker/volumes/ogdb-portal_bundles_data/_data` |

Layout inside: `<mission_id>/<build_id>/{public,staff}.zarr/` plus a
`<mission_id>/current` pointer. A named volume, not the container's own
layer, so bundles survive `docker compose up -d --build`. Bundles are
derived — always rebuildable from the L2 — so they need no backup.

Space: `nrec_app` has a 19 GB root disk, 5.3 GB free (2026-10-12), no
separate data volume. All 48 Seaglider missions ≈ 0.5–1.5 GB. Fits, but the
portal VM should get a separate data volume (NREC dashboard) before Slocum
bundles are added. The builder reports each bundle's size.

---

## 9. Building it

- **Code:** `norgliders-ERDDAP/ingest/` (decided 2026-10-12) — next to
  `batch_push.py`, reusing its config, portal login and OGDB lookups.
- **Input:** the L2 file **live on ERDDAP** for the mission (OGDB records it:
  the dataset detail's `erddapL2File`, a path relative to the shared projects
  folder), read from `/Data` on the machine running the builder — the portal
  VM can't see `/Data`. A mission with nothing live on ERDDAP gets no bundle.
- **Dependencies (all open source):** xarray, zarr (v3), numpy, gsw, netCDF4,
  requests.
- **When:** a step in the existing routine, after `batch_push.py`: for every
  mission whose bundle is missing or stale, build and upload. Batch mode like
  the push scripts: dry run by default, `--commit` to upload, one mission's
  failure doesn't stop the rest.
- **Sizes to expect:** public store ~5–10 MB per mission (15 variables),
  staff store larger. Whole fleet (48 Seaglider missions): well under 1 GB.

## 10. Browser guidance (for the UI session)

- Load `public.zarr` **root metadata + coordinates first** (≈100 KB), draw the
  map and axes, then fetch the selected variables (start with `temperature`,
  `salinity`, `sigma0`), others as the user ticks them.
- Decode in a **Web Worker** (zarrita + gzip via `DecompressionStream`);
  unpack int16 → Float32Array once and keep it.
- **Render with WebGL** (or canvas for small things): a section is a
  `profile × level` texture with a colour map — one draw call, instant zoom.
  T–S and scatter: ~300k points → WebGL point sprites, not SVG.
- Linked zoom = one shared view state (x-range in time/dive/distance, depth
  range) that every panel reads.
- x-axis "Dive": use `dive` + `cast` (two casts per dive); "Distance":
  `distance_km`.
- **Colour scales: default to the 5–95 % range, not min/max.** The bundle
  carries the source file's values unchanged, spikes included — e.g. mission
  004 (BASESTATION, not QC'd) has salinity 21.7–80, mission 023 one oxygen
  value of 2111 µmol/kg. A min/max colour scale lets one spike wash out the
  whole section. Use `min(stats/<var>/p05)` … `max(stats/<var>/p95)` as the
  default range and let the user widen it; `valid_min`/`valid_max` (§7) are
  the true extremes, for the "full range" option only.

## 11. Open decisions

1. ~~Where the builder lives~~ — **decided:** `norgliders-ERDDAP/ingest/`,
   built from the L2 file live on ERDDAP (§9).
2. **Gap filling** — none in v1. If added, add a `<var>_filled` mask array.
3. **Slocum** — same bundle format; the builder needs a Slocum reader (NDP
   OG1 / SOCIB layouts) once Slocum L2 files are recorded in OGDB.
4. **L1 (timeseries)** — not used by the current mockup. If a view needs
   per-measurement data later, add an L1 store (Parquet may suit point data
   better than Zarr).
5. ~~Public vs staff split of `pressure` and `conductivity`~~ — **decided
   (2026-10-12):** both public (§4.1); only the `_raw` versions are staff.
