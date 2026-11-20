#!/usr/bin/env python3
"""Parse Seaglider sg_calib_constants.m files and compare with OGDB (read-only).

Usage: python3 -I sgcalib.py report   -> prints the discrepancy report
       python3 -I sgcalib.py json     -> dumps parsed + compared data as JSON
"""
import glob
import json
import re
import subprocess
import sys
from datetime import date

ROOT = "/Data/gfi/projects/naco/data/delayed"
MONTHS = {m: i + 1 for i, m in enumerate(
    "jan feb mar apr may jun jul aug sep oct nov dec".split())}

# ---------------------------------------------------------------- parsing
def strip_comment(line):
    out, q = [], False
    for ch in line:
        if ch == "'":
            q = not q
        if ch == "%" and not q:
            break
        out.append(ch)
    return "".join(out)


def parse_m(path):
    """Active (uncommented) assignments -> {name: str|float}."""
    vals = {}
    for raw in open(path, errors="replace"):
        line = strip_comment(raw)
        for m in re.finditer(
            r"([A-Za-z_][\w.]*)\s*=\s*(?:'([^']*)'|([-+]?\d*\.?\d+(?:[eEdD][-+]?\d+)?))\s*;?",
            line,
        ):
            k, s, n = m.groups()
            if s is not None:
                vals[k] = s
            else:
                try:
                    vals[k] = float(n.replace("D", "e").replace("d", "e"))
                except ValueError:
                    pass
    return vals


def authority_file(mdir):
    """The single sg_calib_constants.m under a mission folder, preferring a
    non-'_old' folder. Returns (path, [other candidates])."""
    cands = sorted(glob.glob(f"{mdir}/**/sg_calib_constants.m", recursive=True))
    cands = [c for c in cands if not c.endswith(".m.org")]
    if not cands:
        return None, []
    pref = [c for c in cands if "_old" not in c.split("/")[-2]]
    pick = (pref or cands)[0]
    return pick, [c for c in cands if c != pick]


def serial_from(txt, wetlabs=False):
    m = re.search(r"(?:Serial\s*#?:?\s*|SN:?\s*)([A-Za-z0-9-]+?)(?:[\s,:]|$)", txt)
    if not m:
        return None
    s = m.group(1)
    if re.fullmatch(r"\d+", s):
        return str(int(s))
    if not wetlabs:
        return s  # e.g. Contros "DO-1116-004" stays whole
    m2 = re.search(r"-(\d+)$", s)  # BB2FLVMT-871 -> 871
    return str(int(m2.group(1))) if m2 else s


def cal_text(txt):
    m = re.search(r"CAL:?\s*(.*)$", txt.strip())
    return m.group(1).strip().strip("'? ") if m else ""


def date_candidates(t):
    """All plausible dates for a free-form cal-date string -> set of date."""
    t = t.strip().strip("?").strip()
    out = set()
    if not t:
        return out

    def add(y, m, d):
        if y < 100:
            y += 2000
        try:
            out.add(date(y, m, d))
        except ValueError:
            pass

    # 12-Mar-2014 / 12.Mar.2014 / 12mar2014 / 12 March 2014
    m = re.fullmatch(r"(\d{1,2})[\s.\-]*([A-Za-z]{3})[A-Za-z]*[\s.\-]*(\d{2,4})", t)
    if m and m.group(2).lower() in MONTHS:
        add(int(m.group(3)), MONTHS[m.group(2).lower()], int(m.group(1)))
        return out
    # 10/28/2011 (US, from WETLabs)
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{2,4})", t)
    if m:
        add(int(m.group(3)), int(m.group(1)), int(m.group(2)))
        return out
    # 23.04.2019 / 26.02.2021
    m = re.fullmatch(r"(\d{1,2})\.(\d{1,2})\.(\d{2,4})", t)
    if m:
        add(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        return out
    # compact digits: 11512, 101216, 071516, 1612 ... try every split
    if re.fullmatch(r"\d{4,6}", t):
        n = len(t)
        yy = int(t[-2:])
        rest = t[:-2]
        for i in range(1, len(rest)):
            a, b = int(rest[:i]), int(rest[i:])
            add(yy, a, b)  # m d yy
            add(yy, b, a)  # d m yy
        return out
    return out


def parse_file(path, mdir):
    v = parse_m(path)
    r = {"file": path, "id_str": v.get("id_str"), "mission_title": v.get("mission_title")}
    r["mass"] = v.get("mass")
    r["volmax_cc"] = v.get("volmax")
    r["rho0"] = v.get("rho0")
    sensors = []
    ct = v.get("calibcomm")
    if ct:
        kind = "GPCTD" if ("GPCTD" in ct.upper() or v.get("sg_configuration") == 3) else "CT Sail"
        sensors.append({"type": "ct_sensor", "kind": kind, "serial": serial_from(ct),
                        "cal_raw": cal_text(ct), "line": ct.strip(),
                        "coef": {k: v[k] for k in ("t_g", "t_h", "t_i", "t_j", "c_g", "c_h", "c_i", "c_j") if k in v}})
    oxy = v.get("calibcomm_oxygen") or v.get("calibcomm_optode")
    if oxy:
        sensors.append({"type": "do_sensor", "kind": (v.get("comm_oxy_type") or "").strip(),
                        "serial": serial_from(oxy), "cal_raw": cal_text(oxy), "line": oxy.strip(),
                        "coef": {k: v[k] for k in v if k.startswith("optode_PhaseCoef") or k.startswith("optode_ConcCoef")}})
    cont = v.get("calibcomm_contros_optode")
    if cont:
        sensors.append({"type": "other:contros_hydroflash", "kind": "Contros HydroFlash",
                        "serial": serial_from(cont), "cal_raw": cal_text(cont), "line": cont.strip(), "coef": {}})
    eco = (v.get("wlbb2fl_calinfo") or v.get("WETLabsCalData_wlbb2fl_calinfo")
           or next((v[k] for k in v if k.lower().endswith("_calinfo") and "wl" in k.lower()), None))
    if eco:
        sensors.append({"type": "eco_sensor", "kind": "BB2FL-VMT", "serial": serial_from(eco, wetlabs=True),
                        "cal_raw": cal_text(eco), "line": eco.strip(), "coef": {}})
    r["sensors"] = sensors
    r["wl_nums"] = {k: v[k] for k in v if k.startswith("WETLabsCalData.") or k.startswith("wlbb2fl_sig")}
    # sensor families we do not model: any active numeric/str var with these prefixes
    fam = set()
    for k in v:
        kl = k.lower()
        if kl.startswith(("soc", "foffset", "tau20", "o_a", "o_b", "o_c", "o_e")) and kl != "optode":
            fam.add("sbe43 (SBE oxygen) constants")
        if re.match(r"(wlbbfl2|wlfl3|wlbb3|wlbb2|wlbbfl|wlfl)", kl) and not (
                kl.startswith(("wlbb2fl", "wletlabs"))):
            fam.add(k)
        if kl.startswith(("ocr", "par_", "mr_", "rockland", "tmicl", "wlfl", "hydroflash")) or (kl.startswith("sbe_") and "freq" not in kl):
            fam.add(k)
    # numeric wetlabs constants without a calinfo line
    has_wl_nums = any(k.lower().startswith(("wlbb2fl_sig", "wetlabscaldata")) for k in v)
    r["wetlabs_numeric_without_calinfo"] = has_wl_nums and not eco
    r["other_families"] = sorted(fam)
    return r


# ---------------------------------------------------------------- DB (read-only)
def q(sql):
    out = subprocess.run(
        ["docker", "exec", "ogdb-test", "psql", "-U", "postgres", "-d", "ogdb", "-At", "-c",
         f"select coalesce(json_agg(t),'[]'::json) from ({sql}) t"],
        capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def load_db():
    d = {}
    d["missions"] = {m["mission_number"]: m for m in q("""
        select m.id, m.mission_number, m.mission_name, m.deployment_date, m.volume, m.weight_in_air, m.density,
               g.serial_number glider_sn, s.name status
        from missions m left join assets g on g.id=m.glider_asset_id left join status s on s.id=m.status_id
        where m.mission_number is not null""")}
    d["sensors"] = q("""
        select a.id, t.name type, a.serial_number sn, n.pref_label model
        from assets a join asset_types t on t.id=a.asset_type_id
        left join asset_sensor_details d on d.asset_id=a.id left join nvs_terms n on n.id=d.l22_model_id
        where t.name in ('ct_sensor','do_sensor','eco_sensor','mr_sensor')""")
    d["cal"] = {}
    for typ, tbl, extra in (("ct_sensor", "asset_ct_sensor_cal", "sbe_temp_g,sbe_temp_h,sbe_temp_i,sbe_temp_j,sbe_cond_g,sbe_cond_h,sbe_cond_i,sbe_cond_j"),
                            ("do_sensor", "asset_do_sensor_cal", "phasecoef0,phasecoef1,conccoef0,conccoef1"),
                            ("eco_sensor", "asset_eco_sensor_cal", "bb_wl,bb_sf,bb_dc")):
        d["cal"][typ] = q(f"select asset_id, cal_date, {extra} from {tbl}")
    d["build"] = q("""
        select i.mission_id, m.mission_number, i.asset_id, t.name type, a.serial_number sn, i.parent_item_id, i.position
        from mission_build_items i join missions m on m.id=i.mission_id
        join assets a on a.id=i.asset_id join asset_types t on t.id=a.asset_type_id""")
    d["keyfiles"] = q("""select d.mission_id, m.mission_number, d.file_reference from documents d
        join missions m on m.id=d.mission_id where document_type='mission_key_file'""")
    return d


CT_MAP = (("t_g", "sbe_temp_g"), ("t_h", "sbe_temp_h"), ("t_i", "sbe_temp_i"), ("t_j", "sbe_temp_j"),
          ("c_g", "sbe_cond_g"), ("c_h", "sbe_cond_h"), ("c_i", "sbe_cond_i"), ("c_j", "sbe_cond_j"))
DO_MAP = (("optode_PhaseCoef0", "phasecoef0"), ("optode_PhaseCoef1", "phasecoef1"),
          ("optode_ConcCoef0", "conccoef0"), ("optode_ConcCoef1", "conccoef1"))


def close(a, b, rel):
    return b is not None and abs(a - b) <= abs(a) * rel + 1e-12


def global_match(db, typ, coef, mapping, rel):
    pairs = [(f, d) for f, d in mapping if f in coef]
    if len(pairs) < 2:
        return []
    sn = {a["id"]: a["sn"] for a in db["sensors"]}
    return [(sn.get(c["asset_id"]), c["cal_date"]) for c in db["cal"][typ]
            if all(close(coef[f], c.get(d), rel) for f, d in pairs)]


def infer_eco(db, nums):
    """Match 470nm scale factor + dark counts against BB2 cal rows."""
    sf = nums.get("WETLabsCalData.Scatter_470.scaleFactor", nums.get("wlbb2fl_sig470nm_scale_factor"))
    dc = nums.get("WETLabsCalData.Scatter_470.darkCounts", nums.get("wlbb2fl_sig470nm_dark_counts"))
    if sf is None:
        return []
    sn = {a["id"]: a["sn"] for a in db["sensors"]}
    return [(sn.get(c["asset_id"]), c["cal_date"]) for c in db["cal"]["eco_sensor"]
            if close(sf, c.get("bb_sf"), 1e-3) and (dc is None or close(dc, c.get("bb_dc"), 1e-6) or True)]


def compare(parsed, db):
    res = []
    for mn in sorted(parsed):
        p = parsed[mn]
        m = db["missions"].get(mn)
        row = {"mission_number": mn, "folder": p["folder"], "file": p["file"],
               "extra_authority_candidates": p["extras"], "issues": [], "actions": [], "sensors": []}
        res.append(row)
        if not m:
            row["issues"].append("mission_number not in DB")
            continue
        row["mission_id"], row["db_mission_name"], row["deployment_date"] = m["id"], m["mission_name"], m["deployment_date"]
        if p["id_str"] != m["glider_sn"]:
            row["issues"].append(f"GLIDER MISMATCH: file id_str={p['id_str']} vs DB glider SN {m['glider_sn']}")
        # mission physical params
        for fkey, dkey, scale, name in (("mass", "weight_in_air", 1, "mass(kg)->weight_in_air"),
                                         ("volmax_cc", "volume", 0.001, "volmax(cc)->volume(L)"),
                                         ("rho0", "density", 1, "rho0->density")):
            fv, dv = p.get(fkey), m.get(dkey)
            if fv is None:
                continue
            fv = fv * scale
            if dv is None:
                row["actions"].append(f"fill {name} = {fv:g}")
            elif abs(dv - fv) > max(1e-6, abs(fv) * 1e-6):
                row["issues"].append(f"{name}: DB={dv:g} file={fv:g}")
        built = [b for b in db["build"] if b["mission_number"] == mn and b["type"] in
                 ("ct_sensor", "do_sensor", "eco_sensor", "mr_sensor")]
        file_types = set()
        for s in p["sensors"]:
            file_types.add(s["type"])
            e = {"type": s["type"], "kind": s["kind"], "serial": s["serial"], "cal_raw": s["cal_raw"], "notes": []}
            row["sensors"].append(e)
            if s["type"].startswith("other:"):
                e["notes"].append("no asset type for this sensor in OGDB")
                continue
            assets = [a for a in db["sensors"] if a["type"] == s["type"] and a["sn"] == s["serial"]]
            if not assets:
                e["notes"].append(f"SENSOR NOT IN OGDB ({s['type']} SN {s['serial']}) - needs creating")
            elif len(assets) > 1:
                e["notes"].append("multiple assets with this serial")
            else:
                a = assets[0]
                e["asset_id"], e["model"] = a["id"], a["model"]
                in_build = [b for b in built if b["asset_id"] == a["id"]]
                same_type = [b for b in built if b["type"] == s["type"]]
                if in_build:
                    e["notes"].append("in build: OK")
                elif same_type:
                    e["notes"].append("DB BUILD HAS DIFFERENT %s: SN %s" % (s["type"], ",".join(b["sn"] for b in same_type)))
                else:
                    e["notes"].append("ADD to build")
                # calibration
                cands = date_candidates(s["cal_raw"])
                cals = [c for c in db["cal"].get(s["type"], []) if c["asset_id"] == a["id"]]
                caldates = {date.fromisoformat(c["cal_date"]) for c in cals}
                if not cals:
                    e["notes"].append("NO CALIBRATIONS RECORDED for this sensor in OGDB")
                elif not cands:
                    e["notes"].append(f"file cal date unreadable ({s['cal_raw']!r}); DB cals: " +
                                      ", ".join(sorted(map(str, caldates))))
                else:
                    hit = cands & caldates
                    if hit:
                        e["notes"].append("cal date OK (%s)" % ", ".join(map(str, sorted(hit))))
                    else:
                        e["notes"].append("CAL DATE NOT IN OGDB: file says %r -> %s; DB has %s" % (
                            s["cal_raw"], "/".join(map(str, sorted(cands))), ", ".join(sorted(map(str, caldates)))))
                # coefficient cross-check (CT: g/h/i/j; DO: phase/conc)
                if s["type"] == "ct_sensor" and s["coef"] and cals:
                    ok = [c for c in cals if all(c.get(db_k) is not None and abs(c[db_k] - s["coef"][f_k]) <= abs(s["coef"][f_k]) * 1e-5 + 1e-12
                          for f_k, db_k in (("t_g", "sbe_temp_g"), ("t_h", "sbe_temp_h"), ("t_i", "sbe_temp_i"), ("t_j", "sbe_temp_j"),
                                            ("c_g", "sbe_cond_g"), ("c_h", "sbe_cond_h"), ("c_i", "sbe_cond_i"), ("c_j", "sbe_cond_j")))]
                    e["coef_match"] = ok[0]["cal_date"] if ok else None
                    e["notes"].append("coefficients match DB cal %s" % ok[0]["cal_date"] if ok else "coefficients match NO DB cal row")
                if s["type"] == "do_sensor" and s["coef"] and cals:
                    pc = [("optode_PhaseCoef0", "phasecoef0"), ("optode_PhaseCoef1", "phasecoef1"),
                          ("optode_ConcCoef0", "conccoef0"), ("optode_ConcCoef1", "conccoef1")]
                    pc = [(f, d) for f, d in pc if f in s["coef"]]
                    ok = [c for c in cals if pc and all(c.get(d) is not None and abs(c[d] - s["coef"][f]) <= abs(s["coef"][f]) * 1e-4 + 1e-9 for f, d in pc)]
                    e["coef_match"] = ok[0]["cal_date"] if ok else None
                    e["notes"].append("phase/conc coefs match DB cal %s" % ok[0]["cal_date"] if ok else "phase/conc coefs match NO DB cal row")
        for s_ in p["sensors"]:
            if s_["type"] in ("ct_sensor", "do_sensor") and s_["coef"]:
                mapping, rel = (CT_MAP, 1e-5) if s_["type"] == "ct_sensor" else (DO_MAP, 1e-4)
                gm = global_match(db, s_["type"], s_["coef"], mapping, rel)
                e_ = next(x for x in row["sensors"] if x["type"] == s_["type"])
                e_["global_coef_match"] = gm
                if gm and not any(sn_ == s_["serial"] for sn_, _ in gm):
                    e_["notes"].append("!! file serial %s but its coefficients belong to SN %s" % (
                        s_["serial"], "; ".join(f"{a} (cal {b})" for a, b in gm)))
        for b in built:
            tmatch = [s for s in p["sensors"] if s["type"] == b["type"]]
            if not tmatch:
                row["issues"].append(f"DB build has {b['type']} SN {b['sn']} but file lists none -> REMOVE (notify)")
        if p["wetlabs_numeric_without_calinfo"]:
            inf = infer_eco(db, p["wl_nums"])
            row["issues"].append("WETLabs constants active but NO serial in file; 470nm scale factor matches DB cal of: %s" % (
                "; ".join(f"SN {a} (cal {b})" for a, b in inf) or "nothing"))
        if p["other_families"]:
            row["issues"].append("other sensor-like constants: " + ", ".join(p["other_families"]))
        has_key = any(k["mission_number"] == mn and k["file_reference"].endswith("sg_calib_constants.m") for k in db["keyfiles"])
        row["key_file_present"] = has_key
        if not has_key:
            row["actions"].append("attach sg_calib_constants.m as key file")
    return res


# Decisions from review (kept explicit so the SQL is reproducible):
#  - CT 179 (mission 20) and CT 111 (mission 21) are real sensors we do not hold yet: do not insert.
#  - WETLabs with no serial in the file (5, 10, 11, 19, 29): not added until the serial is confirmed.
SKIP_SENSORS = {(20, "ct_sensor"), (21, "ct_sensor")}
SKIP_ECO_MISSIONS = {5, 10, 11, 19, 29}


def make_sql(res, parsed, db):
    items, params = [], []
    for r in res:
        mn = r["mission_number"]
        for s_ in r["sensors"]:
            if s_["type"] not in ("ct_sensor", "do_sensor", "eco_sensor"):
                continue
            if (mn, s_["type"]) in SKIP_SENSORS:
                continue
            if any(n.startswith("SENSOR NOT IN OGDB") for n in s_["notes"]) and mn != 100:
                continue
            items.append((mn, s_["type"], s_["serial"]))
        if mn == 100:
            items.append((100, "do_sensor", "DO-1116-004"))
        p = parsed[mn]
        params.append((mn, p.get("mass"), None if p.get("volmax_cc") is None else p["volmax_cc"] / 1000.0, p.get("rho0")))
    f = lambda x: "NULL" if x is None else repr(round(x, 6))
    out = ["-- Seaglider science sensors fill. Generated by seaglider_calib_audit.py (mode: sql).",
           "-- Idempotent: safe to re-run. Usage:",
           "--   psql -v changed_by=<users.id or empty> -f seaglider_sensor_fill.sql",
           "\\set ON_ERROR_STOP on", "BEGIN;", "",
           "-- 1. Kongsberg as an institute (owner of sg629's sensors)",
           "INSERT INTO agencies (name, long_name, country, url)",
           "SELECT 'Kongsberg', 'Kongsberg Maritime', 'Norway', 'https://www.kongsberg.com/maritime/'",
           "WHERE NOT EXISTS (SELECT 1 FROM agencies WHERE name = 'Kongsberg');", "",
           "-- 2. sg629's science sensors (not UiB-owned). CT Sail takes the model of an existing CT Sail.",
           "WITH new_assets AS (",
           "  INSERT INTO assets (asset_type_id, serial_number, notes, agency_id, changed_by)",
           "  SELECT t.id, v.sn, v.notes, (SELECT id FROM agencies WHERE name = 'Kongsberg'), NULLIF(:'changed_by','')::int",
           "  FROM (VALUES ('ct_sensor','297','Owned by Kongsberg (sg629 is not a UiB glider). From sg_calib_constants.m, mission 100.'),",
           "               ('do_sensor','DO-1116-004','Contros HydroFlash optode. Owned by Kongsberg (sg629 is not a UiB glider). From sg_calib_constants.m, mission 100.')",
           "       ) AS v(type, sn, notes)",
           "  JOIN asset_types t ON t.name = v.type",
           "  WHERE NOT EXISTS (SELECT 1 FROM assets a WHERE a.asset_type_id = t.id AND a.serial_number = v.sn)",
           "  RETURNING id, asset_type_id",
           "), st AS (",
           "  INSERT INTO asset_status_history (asset_id, status_id, changed_by)",
           "  SELECT n.id, o.id, NULLIF(:'changed_by','')::int FROM new_assets n, asset_status_options o WHERE o.name = 'lab'",
           ")",
           "INSERT INTO asset_sensor_details (asset_id, l05_family_id, l22_model_id)",
           "SELECT n.id,",
           "  (SELECT d.l05_family_id FROM asset_sensor_details d JOIN assets a ON a.id=d.asset_id WHERE a.asset_type_id=n.asset_type_id AND d.l05_family_id IS NOT NULL LIMIT 1),",
           "  (SELECT d.l22_model_id FROM asset_sensor_details d JOIN assets a ON a.id=d.asset_id WHERE a.serial_number='185' AND a.asset_type_id=n.asset_type_id)",
           "FROM new_assets n;", "",
           "-- 3. Build items. Only where the mission has no sensor of that type yet (never a second CT/DO/ECO).",
           "INSERT INTO mission_build_items (mission_id, asset_id, changed_by)",
           "SELECT m.id, a.id, NULLIF(:'changed_by','')::int",
           "FROM (VALUES"]
    out.append(",\n".join(f"  ({mn}, '{ty}', '{sn}')" for mn, ty, sn in items if not (ty == 'eco_sensor' and mn in SKIP_ECO_MISSIONS)))
    out += [") AS v(mission_number, type, sn)",
            "JOIN missions m ON m.mission_number = v.mission_number",
            "JOIN asset_types t ON t.name = v.type",
            "JOIN assets a ON a.asset_type_id = t.id AND a.serial_number = v.sn",
            "WHERE NOT EXISTS (",
            "  SELECT 1 FROM mission_build_items i JOIN assets ia ON ia.id = i.asset_id",
            "  WHERE i.mission_id = m.id AND ia.asset_type_id = t.id)",
            "ON CONFLICT (mission_id, asset_id) DO NOTHING;", "",
            "-- 4. Mission mass (kg) / volmax (cc -> L) / rho0. Fills EMPTY values only, never overwrites.",
            "UPDATE missions m SET",
            "  weight_in_air = COALESCE(m.weight_in_air, v.mass),",
            "  volume        = COALESCE(m.volume, v.vol_l),",
            "  density       = COALESCE(m.density, v.rho0),",
            "  changed_by    = NULLIF(:'changed_by','')::int",
            "FROM (VALUES"]
    out.append(",\n".join(f"  ({mn}, {f(a)}::float8, {f(b)}::float8, {f(c)}::float8)" for mn, a, b, c in params))
    out += [") AS v(mission_number, mass, vol_l, rho0)",
            "WHERE m.mission_number = v.mission_number",
            "  AND (m.weight_in_air IS NULL OR m.volume IS NULL OR m.density IS NULL)",
            "  AND (v.mass IS NOT NULL OR v.vol_l IS NOT NULL OR v.rho0 IS NOT NULL);", "", "COMMIT;"]
    return "\n".join(out)


def keyfiles(res, db, docs_dir):
    """LOCAL SANDBOX ONLY: copy each mission's file into docs_dir as <uuid>-sg_calib_constants.m and add
    the documents row. Production uploads go through the app (it owns that volume)."""
    import shutil, uuid, os
    have = {k["mission_number"] for k in db["keyfiles"] if k["file_reference"].endswith("sg_calib_constants.m")}
    os.makedirs(docs_dir, exist_ok=True)
    n = 0
    for r in res:
        if r["mission_number"] in have or "mission_id" not in r:
            continue
        ref = f"{uuid.uuid4()}-sg_calib_constants.m"
        shutil.copyfile(r["file"], os.path.join(docs_dir, ref))
        sql = f"insert into documents (mission_id, document_type, file_reference, file_size_bytes) values ({r['mission_id']}, 'mission_key_file', '{ref}', {os.path.getsize(r['file'])})"
        subprocess.run(["docker", "exec", "ogdb-test", "psql", "-U", "postgres", "-d", "ogdb", "-q", "-c", sql], check=True)
        n += 1
    print(f"attached {n} key files")


def markdown(res, db):
    L = ["# Seaglider science-sensor audit (sg_calib_constants.m vs OGDB)", "",
         "Generated read-only against the local `ogdb-test` sandbox. Nothing was written.", ""]
    built_missions = {b["mission_number"] for b in db["build"] if b["type"] in ("ct_sensor", "do_sensor", "eco_sensor", "mr_sensor")}
    L += ["## 1. Builds that already existed - discrepancies", "",
          "| Mission | Glider | Type | File says | OGDB build has | Verdict |", "|---|---|---|---|---|---|"]
    for r in res:
        if r["mission_number"] not in built_missions:
            continue
        for s in r["sensors"]:
            have = [b["sn"] for b in db["build"] if b["mission_number"] == r["mission_number"] and b["type"] == s["type"]]
            ok = s["serial"] in have
            note = "; ".join(n for n in s["notes"] if n.startswith(("CAL DATE", "!!", "coefficients match NO", "file cal")))
            L.append(f"| {r['mission_number']:03d} | {r['folder'].split('_')[0].split('-')[1]} | {s['type'].split('_')[0]} | SN {s['serial']} (cal {s['cal_raw'] or '?'}) | {', '.join(have) or '-'} | {'OK' if ok else '**MISMATCH**'}{(' - ' + note) if note else ''} |")
    L += ["", "## 2. Missions with no sensors yet - what would be added", "",
          "| Mission | Glider | CT | DO | ECO | Open points |", "|---|---|---|---|---|---|"]
    for r in res:
        if r["mission_number"] in built_missions:
            continue
        cell = {}
        for s in r["sensors"]:
            t = s["type"].split("_")[0]
            flag = "" if any(n.startswith("cal date OK") for n in s["notes"]) else " (cal?)"
            if any(n.startswith("SENSOR NOT IN OGDB") for n in s["notes"]) or s["type"].startswith("other"):
                flag = " (**not in OGDB**)"
            cell[t] = f"SN {s['serial']}{flag}"
        pts = "; ".join(i for i in r["issues"] if "sbe_" not in i)
        L.append(f"| {r['mission_number']:03d} | {r['folder'].split('_')[0].split('-')[1]} | {cell.get('ct','-')} | {cell.get('do', cell.get('other:contros','-'))} | {cell.get('eco','-')} | {pts} |")
    L += ["", "## 3. Mission mass / volume / density", ""]
    fills = [(r["mission_number"], a) for r in res for a in r["actions"] if a.startswith("fill")]
    L.append(f"{len(fills)} empty values would be filled from the files (mass -> `weight_in_air` kg, volmax cc/1000 -> `volume` L, rho0 -> `density`).")
    L += ["", "Existing values that differ from the file:", ""]
    for r in res:
        for i in r["issues"]:
            if i.startswith(("mass", "volmax", "rho0")):
                L.append(f"- {r['mission_number']:03d}: {i}")
    L += ["", "## 4. Files with more than one `sg_calib_constants.m`", ""]
    for r in res:
        if r["extra_authority_candidates"]:
            L.append(f"- {r['mission_number']:03d}: used `{r['file'].split(r['folder']+'/')[-1]}`, also found {[x.split(r['folder']+'/')[-1] for x in r['extra_authority_candidates']]}")
    return "\n".join(L)


def main():
    parsed = {}
    import os
    for mdir in sorted(glob.glob(ROOT + "/[0-9][0-9][0-9]-*")):
        folder = os.path.basename(mdir)
        mn = int(folder[:3])
        path, extras = authority_file(mdir)
        if not path:
            continue
        p = parse_file(path, mdir)
        p["folder"], p["extras"] = folder, extras
        parsed[mn] = p
    db = load_db()
    res = compare(parsed, db)
    if len(sys.argv) > 1 and sys.argv[1] == "sql":
        print(make_sql(res, parsed, db))
        return
    if len(sys.argv) > 1 and sys.argv[1] == "keyfiles":
        keyfiles(res, db, sys.argv[2])
        return
    if len(sys.argv) > 1 and sys.argv[1] == "md":
        print(markdown(res, db))
        return
    if len(sys.argv) > 1 and sys.argv[1] == "json":
        print(json.dumps(res, indent=1, default=str))
        return
    for r in res:
        print(f"\n## {r['mission_number']:03d} {r['folder']}  (DB: {r.get('db_mission_name')})")
        if r["extra_authority_candidates"]:
            print("  !! more than one sg_calib_constants.m:", [x.split(r['folder'] + '/')[-1] for x in r["extra_authority_candidates"]])
        for s in r["sensors"]:
            print(f"  [{s['type']}] {s['kind']} SN {s['serial']}  file-cal={s['cal_raw']!r}")
            for n in s["notes"]:
                print("       -", n)
        for i in r["issues"]:
            print("  ISSUE:", i)
        for a in r["actions"]:
            print("  action:", a)


if __name__ == "__main__":
    main()
