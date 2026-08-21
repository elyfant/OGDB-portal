#!/usr/bin/env python3
"""
Extracts CT sensor calibration coefficients from a calibration
certificate PDF. Reads PDF bytes from stdin, prints one JSON object to
stdout.

Scope is deliberately narrow: only the facility+model combinations we
have real ground-truth certificates for (RBR Legato3/RBR, SBE CT-Sail/
SBE, SBE GPCTD/NOC, SBE GPCTD/SBE). Anything else returns
{"recognized": false} rather than guessing -- the "Read in certificate"
UI falls back to plain manual entry when that happens. The user always
reviews and can edit every extracted value before saving (the checkbox
in the dialog exists precisely because this parsing is not perfect).

Model detection keys off each vendor's own certificate title text
("Slocum Payload CTD" -> GPCTD, "Glider APL" -> CT-Sail, RBR's own
letterhead -> RBR Legato3) rather than the DB's sensor_family/model
fields, since those are still NULL for most backfilled sensors.

Coefficient extraction is done PAGE BY PAGE, not on the whole document
concatenated -- RBR's own cert reuses the same C0/C1/C2/C3/X0.. names
across its temperature/conductivity/pressure pages with completely
different values each time, so extracting from the full text blindly
would silently mix up channels.

Date policy: take the EARLIEST calibration date found anywhere in the
document (confirmed with Fiona -- a single upload can legitimately span
multiple real dates, e.g. temperature/conductivity done one day,
pressure finalized the next). For NOC-format certificates specifically,
only the top-level "Certificate Date" is used, not the per-channel
dates on the embedded Sea-Bird schedule pages -- those are hard to
associate reliably with their label in linearized PDF text, and NOC's
Certificate Date is already what's recorded for existing rows.
"""
import json
import re
import sys
from datetime import date
from io import BytesIO

import pdfplumber
from dateutil import parser as dateparser

GPCTD_TEMP_MAP = {"sbe_temp_a0": "a0", "sbe_temp_a1": "a1", "sbe_temp_a2": "a2", "sbe_temp_a3": "a3"}
CT_SAIL_TEMP_MAP = {"sbe_temp_g": "g", "sbe_temp_h": "h", "sbe_temp_i": "i", "sbe_temp_j": "j"}
SBE_COND_MAP = {
    "sbe_cond_g": "g",
    "sbe_cond_h": "h",
    "sbe_cond_i": "i",
    "sbe_cond_j": "j",
    "sbe_cond_cpcor": "CPcor",
    "sbe_cond_ctcor": "CTcor",
    "sbe_cond_wbotc": "WBOTC",
}
GPCTD_PRES_MAP = {
    "sbe_pres_pa0": "PA0",
    "sbe_pres_pa1": "PA1",
    "sbe_pres_pa2": "PA2",
    "sbe_pres_ptha0": "PTEMPA0",
    "sbe_pres_ptha1": "PTEMPA1",
    "sbe_pres_ptha2": "PTEMPA2",
    "sbe_pres_ptca0": "PTCA0",
    "sbe_pres_ptca1": "PTCA1",
    "sbe_pres_ptca2": "PTCA2",
    "sbe_pres_ptcb0": "PTCB0",
    "sbe_pres_ptcb1": "PTCB1",
    "sbe_pres_ptcb2": "PTCB2",
}
RBR_COND_MAP = {
    "rbr_cond_c0": "C0",
    "rbr_cond_c1": "C1",
    "rbr_cond_c2": "C2",
    "rbr_cond_x0": "X0",
    "rbr_cond_x1": "X1",
    "rbr_cond_x2": "X2",
    "rbr_cond_x3": "X3",
    "rbr_cond_x4": "X4",
    "rbr_cond_x5": "X5",
    "rbr_cond_x6": "X6",
}
RBR_TEMP_MAP = {"rbr_temp_c0": "C0", "rbr_temp_c1": "C1", "rbr_temp_c2": "C2", "rbr_temp_c3": "C3"}
RBR_PRES_MAP = {
    "rbr_pres_c0": "C0",
    "rbr_pres_c1": "C1",
    "rbr_pres_c2": "C2",
    "rbr_pres_c3": "C3",
    "rbr_pres_x0": "X0",
    "rbr_pres_x1": "X1",
    "rbr_pres_x2": "X2",
    "rbr_pres_x3": "X3",
    "rbr_pres_x4": "X4",
    "rbr_pres_x5": "X5",
}


def detect_model(full_text: str) -> str | None:
    t = full_text.upper()
    if "SLOCUM PAYLOAD CTD" in t or "GPCTD" in t:
        return "gpctd"
    if "GLIDER APL" in t:
        return "ct_sail"
    if "RBR LIMITED" in t or "RBRLEGATO" in t.replace(" ", ""):
        return "rbr_legato3"
    return None


def detect_facility(full_text: str) -> str | None:
    t = full_text.upper()
    if "NATIONAL OCEANOGRAPHY CENTRE" in t or "NMFCL" in t:
        return "NOC"
    if "RBR LIMITED" in t or "RBRLEGATO" in t.replace(" ", ""):
        return "RBR"
    if "SEA-BIRD" in t or "SEABIRD" in t:
        return "SBE"
    return None


def classify_page(text: str) -> str | None:
    # Two independent markers per channel: the bare-printout/RBR page
    # title ("... TEMPERATURE CALIBRATION DATA", "Temperature
    # Calibration Certificate", "... Calibration Schedule"), and NOC's
    # own boxed "Parameter TEMPERATURE" label, which never appears
    # adjacent to the word "CALIBRATION" so needs its own check --
    # missing it means NOC's cover page (which sometimes carries
    # coefficients found nowhere else on that certificate's other
    # pages, e.g. PTCB0-2) silently gets skipped entirely.
    t = text.upper()
    if "TEMPERATURE CALIBRATION" in t or re.search(r"PARAMETER\s+TEMPERATURE", t):
        return "temperature"
    if "CONDUCTIVITY CALIBRATION" in t or re.search(r"PARAMETER\s+CONDUCTIVITY", t):
        return "conductivity"
    if (
        "PRESSURE CALIBRATION" in t
        or "PRESSURE SPAN CALIBRATION" in t
        or re.search(r"PARAMETER\s+PRESSURE", t)
    ):
        return "pressure"
    return None


def extract_coef(text: str, raw_name: str) -> float | None:
    # Tolerates every real variant seen so far: "a0 = -1.97e-4",
    # "a0 -1.97e-4" (no operator), "C0: 31.25743E-3" (colon), and
    # trailing annotations like "(nominal)" or "(K)" prefixes -- the
    # regex only captures the number itself. Manual lookbehind/lookahead
    # (not \b) because several names are single letters (g, h, i, j)
    # that \b alone wouldn't protect from matching inside other words.
    pattern = re.compile(
        rf"(?<![A-Za-z0-9_]){re.escape(raw_name)}(?![A-Za-z0-9_])\s*[:=]?\s*"
        rf"([-+]?\d+\.?\d*(?:[eE][-+]?\d+)?)",
        re.IGNORECASE,
    )
    match = pattern.search(text)
    if not match:
        return None
    try:
        return float(match.group(1))
    except ValueError:
        return None


CALIBRATION_DATE_RE = re.compile(
    r"CALIBRATION DATE:?\s*([\d]{1,2}[-\s][A-Za-z]{3,9}[-\s]\d{2,4})", re.IGNORECASE
)
CERTIFICATE_DATE_RE = re.compile(
    r"Certificate Date\s+([\d]{1,2}[-\s][A-Za-z]{3,9}[-\s]\d{4})", re.IGNORECASE
)
RBR_CALIBRATION_DATE_RE = re.compile(
    r"Calibration Date:\s*(\d{4}-\d{2}-\d{2})", re.IGNORECASE
)


def find_dates(text: str) -> list[date]:
    found = []
    for pattern in (CALIBRATION_DATE_RE, CERTIFICATE_DATE_RE, RBR_CALIBRATION_DATE_RE):
        for match in pattern.finditer(text):
            try:
                found.append(dateparser.parse(match.group(1)).date())
            except (ValueError, OverflowError):
                continue
    return found


def build_channel_maps(model: str) -> dict[str, dict[str, str]]:
    if model == "rbr_legato3":
        return {
            "temperature": RBR_TEMP_MAP,
            "conductivity": RBR_COND_MAP,
            "pressure": RBR_PRES_MAP,
        }
    channels = {
        "temperature": GPCTD_TEMP_MAP if model == "gpctd" else CT_SAIL_TEMP_MAP,
        "conductivity": SBE_COND_MAP,
    }
    if model == "gpctd":
        channels["pressure"] = GPCTD_PRES_MAP
    return channels


def extract(pdf_bytes: bytes) -> dict:
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        pages_text = [page.extract_text() or "" for page in pdf.pages]
    full_text = "\n".join(pages_text)

    model = detect_model(full_text)
    facility = detect_facility(full_text)
    if not model or not facility:
        return {
            "recognized": False,
            "reason": "Could not identify a known sensor model/calibration facility combination from this certificate.",
        }

    channel_maps = build_channel_maps(model)
    coefficients: dict[str, float] = {}
    dates_found: list[date] = []

    for text in pages_text:
        channel = classify_page(text)
        if channel and channel in channel_maps:
            for column, raw_name in channel_maps[channel].items():
                value = extract_coef(text, raw_name)
                if value is not None:
                    coefficients[column] = value
        dates_found.extend(find_dates(text))

    if not dates_found:
        return {
            "recognized": False,
            "reason": f"Identified this as a {model}/{facility} certificate, but couldn't find a calibration date on it.",
        }
    if not coefficients:
        return {
            "recognized": False,
            "reason": f"Identified this as a {model}/{facility} certificate, but couldn't find any coefficients on it.",
        }

    return {
        "recognized": True,
        "model": model,
        "facility": facility,
        "calDate": min(dates_found).isoformat(),
        "coefficients": coefficients,
    }


def main() -> None:
    pdf_bytes = sys.stdin.buffer.read()
    try:
        result = extract(pdf_bytes)
    except Exception as exc:  # noqa: BLE001 -- always return JSON, never a raw traceback
        result = {"recognized": False, "reason": f"Failed to read this PDF: {exc}"}
    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
