#!/usr/bin/env python3
"""DRY RUN. Audit sensor calibration certificates found under GliderRefurb against OGDB.

For every CT-Sail certificate (separate "C" and "T" PDFs are merged TEMPERATURE FIRST with
pdfunite, the facility convention) and every Aanderaa optode certificate, this:
  1. runs the app's own parser (parse_certificate.py) to get the calibration date + coefficients
  2. looks for a calibration row for that sensor + date in OGDB (via docker exec ogdb-test psql)
  3. looks for an existing certificate document for the sensor
and prints MISSING / PRESENT. It writes nothing to any database; merged PDFs go to --out.
"""
import argparse, glob, hashlib, json, os, re, subprocess, sys

ROOT = "/net_krb5/uib-san1-nas.uib.no/vol/felles_gfi/felles_gfi_projects_naco/GliderRefurb"
HERE = os.path.dirname(os.path.abspath(__file__))
PY = os.path.join(HERE, "..", ".venv-parse", "bin", "python3")
PARSER = os.path.join(HERE, "parse_certificate.py")
SKIP_DIRS = ("GliderNotes", "SG629_Rental_Documents_202206")
MON = {m: i for i, m in enumerate(["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], 1)}


def psql(sql):
    r = subprocess.run(["docker", "exec", "ogdb-test", "psql", "-U", "postgres", "-d", "ogdb", "-At", "-F", "|", "-c", sql],
                       capture_output=True, text=True, check=True)
    return [l.split("|") for l in r.stdout.splitlines() if l]


def md5(p):
    return hashlib.md5(open(p, "rb").read()).hexdigest()


def parse(pdf):
    r = subprocess.run([PY, PARSER], stdin=open(pdf, "rb"), capture_output=True, text=True)
    try:
        return json.loads(r.stdout)
    except Exception:
        return {"recognized": False, "reason": (r.stderr or r.stdout)[:120]}


def find_pdfs():
    out = []
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [d for d in dn if d not in SKIP_DIRS and d not in ("Data archive", "User Manuals", "User_Manuals", "Toolbox")]
        for f in fn:
            if f.lower().endswith(".pdf") and not f.startswith("._"):
                out.append(os.path.join(dp, f))
    return sorted(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True, help="scratch folder for merged PDFs")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    pdfs = find_pdfs()
    cts = {}      # (serial, date_str) -> {"T": path, "C": path, "folders": set}
    singles = []  # (kind, serial, path)
    for p in pdfs:
        b = os.path.basename(p)
        folder = p[len(ROOT) + 1:].split("/")[0]
        m = re.match(r"Glider APL ([CT])0*(\d+) (\d{1,2})([A-Za-z]{3})(\d\d)\.pdf$", b)
        if m:
            k = (m.group(2), f"{m.group(3)}{m.group(4).title()}{m.group(5)}")
            d = cts.setdefault(k, {"folders": set()})
            d.setdefault(m.group(1), p)
            d["folders"].add(folder)
            continue
        if re.search(r"(CT0\d+_cal|SBE_CT\d+_Cal|SBE_CT_sn\d+)", b, re.I) or re.search(r"4330|Optode|Oxygen|SN ?79|SN ?913", b, re.I) and "Manual" not in b and "Data Sheets" not in p:
            singles.append((p, folder))

    # existing DB state
    cal = {(r[0], r[1]) for r in psql("select a.serial_number, c.cal_date from asset_ct_sensor_cal c join assets a on a.id=c.asset_id")}
    cal_do = {(r[0], r[1]) for r in psql("select a.serial_number, c.cal_date from asset_do_sensor_cal c join assets a on a.id=c.asset_id")}
    docs = {}
    for r in psql("select a.serial_number, d.file_reference from documents d join assets a on a.id=d.asset_id where d.document_type='certificate'"):
        docs.setdefault(r[0], []).append(r[1])
    ct_assets = {r[0] for r in psql("select a.serial_number from assets a join asset_types t on t.id=a.asset_type_id where t.name='ct_sensor'")}
    do_assets = {r[0] for r in psql("select a.serial_number from assets a join asset_types t on t.id=a.asset_type_id where t.name='do_sensor'")}

    print("=== CT-Sail certificate pairs (merged temperature first) ===")
    for (sn, ds), d in sorted(cts.items()):
        if "T" not in d or "C" not in d:
            print(f"CT {sn} {ds}: INCOMPLETE pair (have {[k for k in 'TC' if k in d]}) in {sorted(d['folders'])}")
            continue
        name = f"Glider_APL_{int(sn):04d}_{ds}.pdf"
        merged = os.path.join(a.out, name)
        subprocess.run(["pdfunite", d["T"], d["C"], merged], check=True)
        r = parse(merged)
        date = r.get("calDate")
        in_db = (sn, date) in cal if date else None
        have_doc = any(ds.lower() in f.lower() for f in docs.get(sn, []))
        print(f"CT {sn:>4} {ds:<9} parsed_date={date}  sensor_in_ogdb={sn in ct_assets}  cal_row={'PRESENT' if in_db else 'MISSING'}  cert_doc={'PRESENT' if have_doc else 'MISSING'}  -> {name}  [{', '.join(sorted(d['folders']))}]")

    print("\n=== Other single-file CT / optode certificates ===")
    seen = set()
    for p, folder in singles:
        h = md5(p)
        if h in seen:
            continue
        seen.add(h)
        r = parse(p)
        b = os.path.basename(p)
        sn = re.search(r"(?:CT0|SBE_CT0?|sn|SN ?|No\.?|FsNo|sNo|Sn )(\d{3,4})", b)
        sn = sn.group(1) if sn else "?"
        date = r.get("calDate")
        if not r.get("recognized"):
            print(f"{b:<70} sn={sn:<4} NOT PARSED ({r.get('reason','')[:60]}) -> needs manual reading  [{folder}]")
        else:
            tbl = cal if "ct" in str(r.get("model", "")).lower() or "SBE" in b.upper() else cal_do
            print(f"{b:<70} sn={sn:<4} model={r.get('model')} date={date} cal_row={'PRESENT' if (sn, date) in tbl else 'MISSING'}  [{folder}]")


if __name__ == "__main__":
    main()
