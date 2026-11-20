#!/usr/bin/env python3
"""Upload each Seaglider mission's sg_calib_constants.m as a mission key file,
through the app's own API (POST /missions/:id/files), so the gateway stores the
file in its own documents volume and writes the `documents` row itself.

Why the API and not SQL: the production documents volume belongs to the gateway
container; going through the endpoint is the only way the file and its DB row
stay consistent.

Safe by default:
  * dry run unless --apply is given (prints what it would upload)
  * skips any mission that already has a key file named sg_calib_constants.m
    (so it can be re-run, and will not duplicate)
  * only talks to the URL you give it (default http://localhost:3001)

Production gateway listens on 127.0.0.1:3001 on the VM only, so open a tunnel
first (separate terminal, leave it running):
    ssh -N -L 3001:127.0.0.1:3001 nrec_app

Then:
    python3 upload_seaglider_keyfiles.py --email you@example.com            # dry run
    python3 upload_seaglider_keyfiles.py --email you@example.com --apply    # do it

The password is asked interactively (or read from OGDB_PASSWORD). Your account
needs the editor or admin role.
"""
import argparse
import getpass
import glob
import os
import re
import sys

import requests

ROOT = "/Data/gfi/projects/naco/data/delayed"
FILENAME = "sg_calib_constants.m"


def authority_file(mdir):
    """Same rule as seaglider_calib_audit.py: the single sg_calib_constants.m
    under the mission folder, preferring a folder that is not '_old'."""
    cands = sorted(glob.glob(f"{mdir}/**/{FILENAME}", recursive=True))
    if not cands:
        return None
    pref = [c for c in cands if "_old" not in c.split("/")[-2]]
    return (pref or cands)[0]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", default="http://localhost:3001", help="gateway base URL (default: %(default)s)")
    ap.add_argument("--email", required=True)
    ap.add_argument("--root", default=ROOT)
    ap.add_argument("--apply", action="store_true", help="actually upload (default is a dry run)")
    args = ap.parse_args()
    base = args.url.rstrip("/")

    password = os.environ.get("OGDB_PASSWORD") or getpass.getpass(f"Password for {args.email}: ")
    r = requests.post(f"{base}/auth/login", json={"email": args.email, "password": password}, timeout=30)
    if r.status_code >= 300:
        sys.exit(f"Login failed ({r.status_code}): {r.text[:200]}")
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {r.json()['token']}"
    print(f"Logged in as {args.email} on {base} ({'APPLY' if args.apply else 'dry run'})")

    # mission_number -> mission id, from the app itself
    resp = s.get(f"{base}/missions", timeout=60)
    resp.raise_for_status()
    by_number = {m["missionNumber"]: m["id"] for m in resp.json() if m.get("missionNumber") is not None}

    uploaded = skipped = missing = 0
    for mdir in sorted(glob.glob(f"{args.root}/[0-9][0-9][0-9]-*")):
        num = int(re.match(r"(\d+)-", os.path.basename(mdir)).group(1))
        mid = by_number.get(num)
        if mid is None:
            print(f"  {num:03d}  NOT IN OGDB, skipped")
            missing += 1
            continue
        path = authority_file(mdir)
        if not path:
            print(f"  {num:03d}  no {FILENAME} in folder, skipped")
            missing += 1
            continue
        have = s.get(f"{base}/missions/{mid}/files", timeout=60)
        have.raise_for_status()
        if any(f["name"] == FILENAME for f in have.json()):
            print(f"  {num:03d}  already has {FILENAME}, skipped")
            skipped += 1
            continue
        if not args.apply:
            print(f"  {num:03d}  would upload {path}")
            uploaded += 1
            continue
        with open(path, "rb") as fh:
            up = s.post(
                f"{base}/missions/{mid}/files",
                files=[("files", (FILENAME, fh, "text/plain"))],
                data={"deleteIds": "[]"},
                timeout=120,
            )
        if up.status_code >= 300:
            sys.exit(f"  {num:03d}  UPLOAD FAILED ({up.status_code}): {up.text[:200]}")
        print(f"  {num:03d}  uploaded")
        uploaded += 1

    verb = "uploaded" if args.apply else "would upload"
    print(f"\n{verb} {uploaded}, already present {skipped}, skipped/missing {missing}")
    if not args.apply:
        print("Dry run only. Add --apply to upload.")


if __name__ == "__main__":
    main()
