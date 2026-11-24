#!/usr/bin/env python3
"""SG629 calibrations, through the app's own API (like refurb_import.py). Dry run unless --apply.
Run sg629_sensors.sql FIRST (it creates the SeaOWL asset).

    python3 sg629_import.py --url http://localhost:3002 --email you@uib.no [--apply]
"""
import argparse, getpass, json, os, subprocess, sys, tempfile
import requests

ROOT = "/net_krb5/uib-san1-nas.uib.no/vol/felles_gfi/felles_gfi_projects_naco/GliderRefurb/SG629_Rental_Documents_202206/SG629 KML Glider/Seaglider/Sensors"
HERE = os.path.dirname(os.path.abspath(__file__))
PY = os.path.join(HERE, "..", ".venv-parse", "bin", "python3")
PARSER = os.path.join(HERE, "parse_certificate.py")

SEAOWL = {  # WET Labs characterization sheets, 12 Sep 2016
    "chla_dc": 50, "chla_sf": 1.635e-3, "chla_maxoutput": 262, "chla_res": 1.3,
    "bb_wl": 700, "bb_sf": 1.839e-7, "bb_dc": 48, "bb_maxoutput": 2.94e-2, "bb_res_counts": 1.3, "bb_res_sf": 2.48e-7,
    "cdom_dc": 49, "cdom_sf": 8.443e-3, "cdom_maxoutput": 1351, "cdom_res": 1.6,
    "calibration_facility": "WET Labs",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True); ap.add_argument("--email", required=True); ap.add_argument("--apply", action="store_true")
    a = ap.parse_args(); base = a.url.rstrip("/")
    pw = os.environ.get("OGDB_PASSWORD") or getpass.getpass(f"Password for {a.email}: ")
    r = requests.post(f"{base}/auth/login", json={"email": a.email, "password": pw}, timeout=30)
    if r.status_code >= 300: sys.exit(f"Login failed ({r.status_code})")
    s = requests.Session(); s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    print(f"Logged in on {base} ({'APPLY' if a.apply else 'DRY RUN'})\n")
    aid = {(x["assetType"], x["serialNumber"]): x["id"] for x in s.get(f"{base}/assets", timeout=60).json()}
    work = tempfile.mkdtemp(prefix="sg629_")

    # CT 297: T then C merged (facility convention), coefficients from the app parser
    t, c = f"{ROOT}/SBE CT Sail/T0297.pdf", f"{ROOT}/SBE CT Sail/C0297.pdf"
    ct_pdf = os.path.join(work, "Glider_APL_0297_13May16.pdf")
    subprocess.run(["pdfunite", t, c, ct_pdf], check=True)
    p = json.loads(subprocess.run([PY, PARSER], stdin=open(ct_pdf, "rb"), capture_output=True, text=True).stdout)
    if not p.get("recognized") or p["calDate"] != "2016-05-13":
        sys.exit(f"unexpected parse of CT 297: {p}")
    owl_pdf = os.path.join(work, "SEAOWLA2K-012_12Sep16.pdf")
    subprocess.run(["cp", f"{ROOT}/SBE SEAOWL/SEAOWLA2K-012/SEAOWLA2K-012_201612.pdf", owl_pdf], check=True)

    jobs = [
        ("ct_sensor", "297", "2016-05-13", dict(p["coefficients"], calibration_facility="SBE"), ct_pdf),
        ("eco_sensor", "SEAOWLA2K-012", "2016-09-12", SEAOWL, owl_pdf),
        # Contros: the certificate PDF in the folder is damaged (truncated), so no file; the
        # coefficients are static Contros constants with no matching columns, so date + facility only.
        ("do_sensor", "DO-1116-004", "2016-12-20", {"calibration_facility": "Kongsberg Maritime Contros"}, None),
    ]
    for kind, sn, date, coef, pdf in jobs:
        sid = aid.get((kind, sn))
        if sid is None:
            print(f"  {kind} {sn}: not in OGDB (run sg629_sensors.sql first), skipped"); continue
        have = s.get(f"{base}/assets/{sid}/calibrations", timeout=60).json()
        if date in [str(x.get("calDate"))[:10] for x in have]:
            print(f"  {kind} {sn} {date}: already there, skipped"); continue
        print(f"  {kind} {sn} {date}: {len(coef)} fields, certificate: {os.path.basename(pdf) if pdf else 'NONE'}")
        if a.apply:
            kw = {"files": {"certificate": (os.path.basename(pdf), open(pdf, "rb"), "application/pdf")}} if pdf else {}
            resp = s.post(f"{base}/assets/{sid}/calibrations", data={"calDate": date, "coefficients": json.dumps(coef)}, timeout=120, **kw)
            if resp.status_code >= 300: sys.exit(f"FAILED {sn}: {resp.status_code} {resp.text[:200]}")
    if not a.apply: print("\nDry run only. Add --apply to write.")


if __name__ == "__main__":
    main()
