#!/usr/bin/env python3
"""Import the GliderRefurb findings into OGDB THROUGH THE APP'S OWN API.

Why the API: the gateway owns the documents volume and writes the file, the `documents`
row, the calibration row and the audit trail itself, so nothing can get out of step. The same
script works for ogdb-test (local gateway) and production (through the ssh tunnel).

Dry run by default (prints exactly what it would do). Add --apply to write. Idempotent:
  * an event whose title and start date already match is left alone,
  * a calibration that already exists (sensor + date) is skipped,
  * existing "old tone" events are matched by glider + original date + keyword and UPDATED in place
    (type, contact, attachments are kept; only title, description and the dates given here change).

    python3 refurb_import.py --url http://localhost:3002 --email you@uib.no            # dry run
    python3 refurb_import.py --url http://localhost:3002 --email you@uib.no --apply
Password: prompt, or OGDB_PASSWORD. Needs an editor/admin account.
"""
import argparse, getpass, json, os, re, subprocess, sys, tempfile

import requests

ROOT = "/net_krb5/uib-san1-nas.uib.no/vol/felles_gfi/felles_gfi_projects_naco/GliderRefurb"
HERE = os.path.dirname(os.path.abspath(__file__))
PY = os.path.join(HERE, "..", ".venv-parse", "bin", "python3")
PARSER = os.path.join(HERE, "parse_certificate.py")

KM = "Kongsberg Maritime Ltd"
KUTI = "Kongsberg Underwater Technology Inc"

# ---- 1. Existing events to rewrite (same tone). match = (glider, original start date, keyword in old title) ----
UPDATES = [
    dict(glider="559", old=("2016-08-29", "U32708"), title="Factory refurbishment (RMA U32708-A)",
         details=f"{KM}, Aberdeen. Standard 10/24V refurbishment. New end cap/VBD module and lower hatch. CT sail #0179 swapped out and returned to KUTI; #0192 fitted. O2 optode #809 recalibrated. Argos tag removed. Trimsheet reweighed (~800 g discrepancy found)."),
    dict(glider="562", old=("2016-08-30", "U32707"), title="Factory refurbishment (RMA U32707-A)",
         details=f"{KM}, Aberdeen. Standard 10/24V refurbishment. New end cap/VBD module. CT sail #0111 swapped out and returned to KUTI; #0263 fitted. O2 optode #797 recalibrated. Argos tag removed."),
    dict(glider="560", old=("2017-07-18", "U32929"), title="Factory refurbishment (RMA U32929/A)",
         details=f"{KM}, Aberdeen. Standard 15/15V refurbishment: new batteries, upgraded gear mount collar, UW ICE firmware. CT #0180 sent for calibration (stanchion corrosion found); spare CT #0187 from UiB fitted. Optode #805 not recalibrated (admin error)."),
    dict(glider="561", old=("2017-07-18", "U32930"), title="Factory refurbishment (RMA U32930/A)",
         details=f"{KM}, Aberdeen. Standard 15/15V refurbishment: new batteries, upgraded gear mount collar, UW ICE firmware. CT #0185 sent for calibration (corrosion near thermistor grommet); spare CT #0189 from UiB fitted. Optode #799 not recalibrated (admin error)."),
    dict(glider="560", old=("2019-12-07", "00196G"), title="Factory service (RMA00196G)", start="2019-07-12", end="2019-07-12",
         details=f"{KUTI}. Poor communications: corroded antenna connector replaced, modem upgraded (flow control). VBD and mass shifter reconditioned (level II). CT #0185 (cal 5 Jun 2019) and optode #805 (cal 23 Apr 2019) recalibrated. Batteries at 75%, not replaced."),
    dict(glider="560", old=("2020-08-27", "CSCS"), title="Service by CSCS",
         details="Cyprus Subsea Consulting & Services (CSCS) at UiB. New rudder. Mainboard swapped with SG561's (CT faults traced to mainboard). 15V batteries from SG561 fitted (82%). CT #0185 replaced by #380 (cal 2 Jan 2020). Trimmed for the Barents Sea."),
    dict(glider="561", old=("2020-08-27", "CSCS"), title="Service by CSCS",
         details="Cyprus Subsea Consulting & Services (CSCS) at UiB. Broken rudder; VBD failed on the last mission. Replacement VBD was the wrong voltage (10/24V, glider is 15V), so not fitted. Batteries and mainboard moved to SG560. Glider left disassembled in storage."),
    dict(glider="562", old=("2020-08-07", "CSCS"), title="Service by CSCS",
         details="Cyprus Subsea Consulting & Services (CSCS) at UiB. New 24V battery and the 10V from SG564. GPS cell replaced. Trimmed for the West Spitsbergen Current (Fram Strait). Ice map and science file issues noted."),
    dict(glider="564", old=("2020-08-27", "CSCS"), title="Service by CSCS",
         details="Cyprus Subsea Consulting & Services (CSCS) at UiB. New 24V and 10V batteries. CT checked in tank against an SBE37. Trimmed for Dronning Maud Land."),
    dict(glider="561", old=("2014-08-01", "IOP VBD"), title="VBD upgrade (APL-UW)", start="2024-04-01", end="2024-08-01",
         details="IOP (APL-UW Seaglider Center). VBD shipped Apr 2024 (day approximate), returned 22 Jul 2024 with CT sail plug. Rebuilt with low-pressure boost pump, Swagelok fittings, mechanical shaft seal, new bellofram and hydraulic endcap. Tested 100 cycles to 1500 psi. Set D_BOOST,0 and T_BOOST,0."),
]

# ---- 2. New events (created with the report attached) ----
NEW = [
    dict(glider="563", start="2016-05-03", end="2016-05-03", title="Factory refurbishment (RMA 32641/A)",
         file="SG563_Documents_201605/SG563_PostRefurbReport_030516.pdf",
         details=f"{KM}, Aberdeen. Corroded electronics hull and mass shifter bulkhead replaced; other corrosion sealed. New grounding/anode system, gear mount collar, batteries, antenna module. Corroded CT #0192 replaced by #0191 (cal 31 Mar 2016)."),
    dict(glider="564", start="2017-02-13", end="2017-02-13", title="Factory refurbishment (RMA 32740/A)",
         file="SG564_Documents_201702/SG564_PostRefurbReport_130217.pdf",
         details=f"{KM}, Aberdeen. Major oil leak: end cap sent to factory (magnetic seal replaced, VBD plumbing updated). New batteries, antenna module, lower hatch. CT #0194 (cal 4 Nov 2016) and optode #796 (cal 12 Oct 2016) recalibrated."),
    dict(glider="562", start="2018-08-21", end="2018-08-21", title="Factory service (RMA00147G)",
         file="SG562_PostRefurb_201808/SG562 Seaglider Service Report.pdf",
         details=f"{KUTI}. Reduced VBD pump rate. Corrosion under an end-cap port, so end cap replaced. VBD and mass shifter reconditioned (level II), 10/24V batteries. Kistler Ti pressure sensor, flow-control modem, Ametek antenna connector, ICE firmware. CT #0187 and optode #797 recalibrated."),
    dict(glider="564", start="2018-07-25", end="2018-07-25", title="Factory service (RMA00150G)",
         file="SG562_PostRefurb_201808/SG564 Seaglider Service Report.pdf",
         details=f"{KUTI}. Failed pressure sensor replaced (Kistler). 10V battery replaced. VBD and mass shifter reconditioned (level II). WETLabs reintegrated. Corrosion under an end-cap port, so end cap replaced. CT #0194 (16 Feb 2018) and optode #796 (23 Feb 2018) calibrated. Flow-control modem, Ametek antenna connector."),
    dict(glider="563", start="2019-09-18", end="2020-10-27", title="Factory repair (RMA00227G, case 3337)",
         file="SG563_Documents_202101/20210108 Service report.pdf",
         details="Hydroid (KUTI). Shipped 18 Sep 2019; report dated 27 Oct 2020. Roll retries and a 10V-bus abort after the Mar 2019 deployment. VBD magnetic-seal leak. Motors, potentiometers, modem and mainboard replaced (RevB to RevE ARM). Aanderaa optode had a short (cause of the abort); replacement optode #913 (cal 26 Feb 2021)."),
    dict(glider="563", start="2023-10-01", end="2023-11-06", title="VBD upgrade (APL-UW)",
         file="SG563-564_IOPrepairs_202308/UBergen - VBD upgrade - service notes.pdf",
         details="IOP (APL-UW Seaglider Center). VBD leaking oil. Rebuilt without removing the bladder (nut seized): Swagelok plumbing in series, low-pressure boost pump, mechanical shaft seal, new hydraulic endcap and filter. Tested 100 cycles to 1500 psi. Service notes dated 6 Nov 2023."),
    dict(glider="564", start="2023-10-01", end="2023-11-06", title="VBD upgrade (APL-UW)",
         file="SG563-564_IOPrepairs_202308/UBergen - VBD upgrade - service notes.pdf",
         details="IOP (APL-UW Seaglider Center). Slow pump rates and minor leak; red residue in main pump. Seized bladder nut drilled out, new bladder. Rebuilt: Swagelok plumbing in series, low-pressure boost pump, mechanical shaft seal. Tested 100 cycles to 1500 psi. Lin-pot hardware limits set 4060/415; software limits should match."),
]

# ---- 3. Calibrations (each creates a calibration event + cal row + certificate) ----
CT194 = {"sbe_temp_g": 4.34294126e-3, "sbe_temp_h": 6.22949524e-4, "sbe_temp_i": 2.30752834e-5, "sbe_temp_j": 2.48116416e-6,
         "sbe_cond_g": -9.60080706, "sbe_cond_h": 1.09616581, "sbe_cond_i": -6.52252141e-4, "sbe_cond_j": 1.38966187e-4,
         "sbe_cond_cpcor": -9.57e-8, "sbe_cond_ctcor": 3.25e-6, "calibration_facility": "SBE"}
DO796 = {"foil_batch": "2808F", "tempcoef0": 26.1909, "tempcoef1": -0.0312184, "tempcoef2": 2.94009e-6, "tempcoef3": -4.3353e-9,
         "phasecoef0": -8.14395, "phasecoef1": 1.1749, "phasecoef2": 0, "phasecoef3": 0, "calibration_facility": "AADI"}
CALS = [
    dict(sensor="191", kind="ct_sensor", date="2016-03-31", name="Glider_APL_0191_31Mar16.pdf", parse=True,
         merge=["SG563_Documents_201605/Seaglider/Sensors/SBE_CT/Glider APL T0191 31Mar16.pdf",
                "SG563_Documents_201605/Seaglider/Sensors/SBE_CT/Glider APL C0191 31Mar16.pdf"]),
    dict(sensor="194", kind="ct_sensor", date="2016-11-04", name="Glider_APL_0194_04Nov16.pdf", coef=CT194,
         swap_pages="SG564_Documents_201702/Seaglider/Sensors/SBE_CT/SBE_CT0194_Cal.pdf"),  # scan is C then T: reorder, temperature first
    dict(sensor="796", kind="do_sensor", date="2016-10-12", name="2016-10-12_Aanderaa_4330IE_SN_796.pdf", coef=DO796,
         file="SG564_Documents_201702/Seaglider/Sensors/Aanderaa/AA4330_796_Cal.pdf"),
]


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def build_cal_pdf(c, work):
    out = os.path.join(work, c["name"])
    if "merge" in c:
        run(["pdfunite", *[os.path.join(ROOT, p) for p in c["merge"]], out])
    elif "swap_pages" in c:
        src = os.path.join(ROOT, c["swap_pages"])
        run(["pdfseparate", src, os.path.join(work, "pg%d.pdf")])
        run(["pdfunite", os.path.join(work, "pg2.pdf"), os.path.join(work, "pg1.pdf"), out])
    else:
        import shutil
        shutil.copyfile(os.path.join(ROOT, c["file"]), out)
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", required=True)
    ap.add_argument("--email", required=True)
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    base = a.url.rstrip("/")
    pw = os.environ.get("OGDB_PASSWORD") or getpass.getpass(f"Password for {a.email}: ")
    r = requests.post(f"{base}/auth/login", json={"email": a.email, "password": pw}, timeout=30)
    if r.status_code >= 300:
        sys.exit(f"Login failed ({r.status_code}): {r.text[:150]}")
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    print(f"Logged in on {base} ({'APPLY' if a.apply else 'DRY RUN'})\n")

    assets = s.get(f"{base}/assets", timeout=60).json()
    aid = {(x["assetType"], x["serialNumber"]): x["id"] for x in assets}

    def ev(serial):
        gid = aid[("glider", serial)]
        return gid, s.get(f"{base}/assets/{gid}/servicing", timeout=60).json()

    def ok(resp, what):
        if resp.status_code >= 300:
            sys.exit(f"FAILED {what}: {resp.status_code} {resp.text[:200]}")

    n = dict(upd=0, new=0, cal=0, skip=0)

    print("== Rewrite existing events ==")
    for u in UPDATES:
        gid, events = ev(u["glider"])
        start = u.get("start", u["old"][0])
        end = u.get("end")
        done = [e for e in events if e["title"] == u["title"] and e["startDate"] == start]
        if done:
            print(f"  SG{u['glider']} {start}  already done, skipped"); n["skip"] += 1; continue
        m = [e for e in events if e["startDate"] == u["old"][0] and u["old"][1].lower() in (e["title"] or "").lower()]
        if len(m) != 1:
            print(f"  SG{u['glider']} {u['old']}  !! expected 1 match, found {len(m)} -> SKIPPED, check by hand"); n["skip"] += 1; continue
        e = m[0]
        print(f"  SG{u['glider']} id {e['id']} {e['startDate']} -> {start}  '{e['title']}' => '{u['title']}'")
        n["upd"] += 1
        if a.apply:
            body = {"eventType": e["eventType"], "title": u["title"], "startDate": start,
                    "endDate": end or e["endDate"] or "", "details": u["details"],
                    "performedByContactId": e["performedByContactId"] or ""}
            ok(s.patch(f"{base}/assets/{gid}/servicing/{e['id']}", data=body, timeout=60), "update")

    print("\n== New events (report attached) ==")
    for x in NEW:
        gid, events = ev(x["glider"])
        if any(e["title"] == x["title"] and e["startDate"] == x["start"] for e in events):
            print(f"  SG{x['glider']} {x['start']}  already there, skipped"); n["skip"] += 1; continue
        path = os.path.join(ROOT, x["file"])
        print(f"  SG{x['glider']} {x['start']} to {x['end']}  '{x['title']}'  + {os.path.basename(path)}")
        n["new"] += 1
        if a.apply:
            body = {"eventType": "factory_repair", "title": x["title"], "startDate": x["start"], "endDate": x["end"], "details": x["details"]}
            with open(path, "rb") as fh:
                ok(s.post(f"{base}/assets/{gid}/servicing", data=body, files={"attachment": (os.path.basename(path), fh, "application/pdf")}, timeout=120), "new event")

    print("\n== Calibrations (cal row + calibration event + certificate) ==")
    work = tempfile.mkdtemp(prefix="refurb_certs_")
    for c in CALS:
        sid = aid.get((c["kind"], c["sensor"]))
        if sid is None:
            print(f"  {c['kind']} {c['sensor']}: sensor NOT in OGDB, skipped"); n["skip"] += 1; continue
        have = s.get(f"{base}/assets/{sid}/calibrations", timeout=60)
        dates = []
        if have.status_code < 300:
            dates = [str(x.get("calDate") or x.get("cal_date") or "")[:10] for x in have.json()]
        if c["date"] in dates:
            print(f"  {c['kind']} {c['sensor']} {c['date']}  already there, skipped"); n["skip"] += 1; continue
        pdf = build_cal_pdf(c, work)
        coef = c.get("coef")
        if c.get("parse"):
            p = json.loads(subprocess.run([PY, PARSER], stdin=open(pdf, "rb"), capture_output=True, text=True).stdout)
            if not p.get("recognized") or p["calDate"] != c["date"]:
                sys.exit(f"parser did not return the expected date for {c['name']}: {p}")
            coef = dict(p["coefficients"], calibration_facility="SBE")
        print(f"  {c['kind']} {c['sensor']} {c['date']}  -> {c['name']}  ({len(coef)} fields)")
        n["cal"] += 1
        if a.apply:
            with open(pdf, "rb") as fh:
                ok(s.post(f"{base}/assets/{sid}/calibrations", data={"calDate": c["date"], "coefficients": json.dumps(coef)},
                          files={"certificate": (c["name"], fh, "application/pdf")}, timeout=120), "calibration")

    print(f"\n{'applied' if a.apply else 'would do'}: {n['upd']} updates, {n['new']} new events, {n['cal']} calibrations; skipped {n['skip']}")
    if not a.apply:
        print("Dry run only. Add --apply to write.")


if __name__ == "__main__":
    main()
