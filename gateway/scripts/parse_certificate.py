#!/usr/bin/env python3
"""
Extracts CT and DO sensor calibration coefficients from a calibration
certificate PDF. Reads PDF bytes from stdin, prints one JSON object to
stdout.

Scope is deliberately narrow: only the facility+model combinations we
have real ground-truth certificates for (RBR Legato3/RBR, SBE CT-Sail/
SBE, SBE GPCTD/NOC, SBE GPCTD/SBE, SBE "WEBB Glider"/SBE, AADI Oxygen
Optode). Anything else
returns {"recognized": false} rather than guessing -- the "Read in
certificate" UI falls back to plain manual entry when that happens. The
user always reviews and can edit every extracted value before saving
(the checkbox in the dialog exists precisely because this parsing is
not perfect).

AADI optode certificates are handled by extract_do_sensor() below,
dispatched separately from the CT/RBR logic since the two vendors'
certificates share no structure at all. See that function's docstring
for AADI-specific format notes -- most importantly, coefficients are
extracted POSITIONALLY (first number after the row label = index 0,
etc.), never by trusting a physical meaning for a given index, because
the same physical coefficient for the same sensor has been confirmed to
print at different index positions across AADI certificate template
vintages (2009/2021 vs 2017 forms).

Recognizing an AADI certificate does NOT depend on which optode model
it's for (4330I, 4330IE, 4831F, etc. all use the same coefficient row
names -- SVUFoilCoef/PhaseCoef/TempCoef/ConcCoef -- across every form
number seen so far) -- only the certificate template (Form 770/784/805/
830/857) matters, unlike CT sensors where model genuinely changes the
channel-name set (see build_channel_maps above).

Model detection keys off each vendor's own certificate title text
("Slocum Payload CTD" -> GPCTD, "Glider APL" -> CT-Sail, RBR's own
letterhead -> RBR Legato3) rather than the DB's sensor_family/model
fields, since those are still NULL for most backfilled sensors.

Coefficient extraction is done PAGE BY PAGE, not on the whole document
concatenated -- RBR's own cert reuses the same C0/C1/C2/C3/X0.. names
across its temperature/conductivity/pressure pages with completely
different values each time, so extracting from the full text blindly
would silently mix up channels.

"WEBB Glider" certificates: the CT sensor on early (pre-GPCTD) Slocum
G1 gliders, custom-OEM'd by Sea-Bird for Webb Research -- every section
header on these certs literally reads "WEBB GLIDER {TYPE} CALIBRATION
DATA" instead of a standard model name (see scripts/nvs_terms.yaml's
TOOL0669 entry in the OGDB repo for the full backstory; OGDB stores it
under NVS L22 TOOL0669, "Sea-Bird SBE 41CP CTD", inferred by era/design
rather than a vendor cross-reference). Confirmed against two real
certs for glider 0069 (RMA 87931, 03-Feb-16 and 19-Feb-16): temperature
(a0-a3) and conductivity (g/h/i/j/CPcor/CTcor/WBOTC) print the exact
same coefficient names as GPCTD, so those maps are reused as-is -- only
the pressure channel differs, printing "PTHA0/1/2" where GPCTD's own
certs print "PTEMPA0/1/2" for the same physical thermal-correction
coefficients (see WEBB_GLIDER_PRES_MAP).

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
# Same physical coefficients as GPCTD_PRES_MAP, same PA0-2/PTCA0-2/
# PTCB0-2 names too -- only the thermal-correction-for-pressure trio
# differs ("PTHA0/1/2" here vs GPCTD's "PTEMPA0/1/2"), confirmed against
# the real WEBB Glider 0069 pressure certs.
WEBB_GLIDER_PRES_MAP = {
    "sbe_pres_pa0": "PA0",
    "sbe_pres_pa1": "PA1",
    "sbe_pres_pa2": "PA2",
    "sbe_pres_ptha0": "PTHA0",
    "sbe_pres_ptha1": "PTHA1",
    "sbe_pres_ptha2": "PTHA2",
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
    if "WEBB GLIDER" in t:
        return "webb_glider_ctd"
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
        # WEBB Glider certs print a0-a3 for temperature, same as GPCTD --
        # only pressure's naming actually differs (see WEBB_GLIDER_PRES_MAP).
        "temperature": CT_SAIL_TEMP_MAP if model == "ct_sail" else GPCTD_TEMP_MAP,
        "conductivity": SBE_COND_MAP,
    }
    if model == "gpctd":
        channels["pressure"] = GPCTD_PRES_MAP
    elif model == "webb_glider_ctd":
        channels["pressure"] = WEBB_GLIDER_PRES_MAP
    return channels


# --- AADI Oxygen Optode (do_sensor) -----------------------------------
#
# AADI's own certificate templates print each coefficient row as one
# line of text: a label, then its values in sequence ("TempCoef
# 2.61909E01 -3.12184E-02 ..."). Extraction is purely positional -- the
# Nth number after the label becomes index N-1 -- rather than trusting
# the "Index" header row printed above it, because the same physical
# calibration for the same sensor (SN 796) has been confirmed to print
# its two real TempCoef values at index 0,1 on a 2011-vintage
# certificate (Form 805) and at index 4,5 on a 2018-vintage one (Form
# 857). That's a genuine quirk of AADI's template changing over time,
# not a parsing bug -- so the same physical coefficient can legitimately
# land in a different column depending on which certificate vintage
# produced it. Confirmed by hand against two real certificates for SN
# 796 (2011-10-18 and 2018-02-23).
#
# "Form No 857" (2-point recalibration), "Form No 805" (2009-template
# multipoint) and "Form No 830" (2021-template multipoint, also seen
# bundling TWO sensors' certificates back-to-back in one PDF -- e.g. a
# pair calibrated together, pages 1-2 for one serial then pages 3-4 for
# the other) are recognized as calibration certificates. A bundled PDF
# may also contain AADI's production test sheet (Form 784) or the
# foil-level certificate (Form 770, keyed by foil batch rather than
# sensor serial) -- both are deliberately skipped: the production sheet
# isn't a calibration at all, and the foil-level cert's polynomial model
# (FoilCoefA/B, FoilPolyDegT/O) is a different, foil-batch-keyed
# structure that's out of scope here.
#
# Detecting "is this an AADI page at all" can't rely on the product name
# containing "Oxygen Optode" -- Form 830's Product field is just the
# bare model number ("Product: 4831F"), no "Optode" text anywhere on the
# page. Presence of any of AADI's own coefficient row labels is a more
# reliable fingerprint and covers every form seen so far.
DO_FLOAT_RE = r"[-+]?\d+\.\d+[Ee][-+]?\d+"

# column prefix -> (row label as AADI prints it, how many values to read)
DO_COEF_ROWS: dict[str, tuple[str, int]] = {
    "svufoilcoef": ("SVUFoilCoef", 7),
    "phasecoef": ("PhaseCoef", 4),
    "tempcoef": ("TempCoef", 6),
    "conccoef": ("ConcCoef", 2),
}
AADI_PAGE_MARKERS = tuple(label.upper() for label, _ in DO_COEF_ROWS.values()) + (
    "OXYGEN OPTODE",
)

# Form 857 prints "Calibration date: 23.02.2018" (DD.MM.YYYY); Form 805
# and 830 print "Calibration Date: 8 October 2011" / "30.01.2023" (both
# accepted by the same alternation). All require the word "Calibration"
# immediately before "Date" so this never matches the unrelated
# signature-line "Date:" (every form repeats the date near the
# signature without the "Calibration" prefix) or the production-test
# sheet's own unrelated "Date: 18 October 2011" line.
AADI_CAL_DATE_RE = re.compile(
    r"Calibration Date:?\s*(\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\s+[A-Za-z]+\s+\d{4})",
    re.IGNORECASE,
)
# Three different labels for the same concept across form vintages:
# "FoilID:" (857), "Sensing Foil Batch No:" (805), "Foil batch no:" (830).
AADI_FOIL_BATCH_RES = (
    re.compile(r"FoilID:\s*(\S+)"),
    re.compile(r"Sensing Foil Batch No:\s*(\S+)", re.IGNORECASE),
    re.compile(r"Foil batch no:\s*(\S+)", re.IGNORECASE),
)
# "Serial no: 796" (857/830) / "Serial No: 796" (805) -- used to pick
# out just the target asset's pages when a PDF bundles more than one
# sensor's certificate (see the Form 830 note above).
AADI_SERIAL_RE = re.compile(r"Serial no:?\s*(\S+)", re.IGNORECASE)


def classify_aadi_form(text: str) -> str | None:
    if re.search(r"Form\s*No\.?\s*857", text, re.IGNORECASE):
        return "recal_2pt"
    if re.search(r"Form\s*No\.?\s*805", text, re.IGNORECASE):
        return "multipoint_2009"
    if re.search(r"Form\s*No\.?\s*830", text, re.IGNORECASE):
        return "multipoint_2021"
    return None


def extract_coef_row(text: str, label: str, count: int) -> dict[int, float]:
    pattern = re.compile(
        rf"\b{re.escape(label)}\s+((?:{DO_FLOAT_RE}\s*){{1,{count}}})"
    )
    match = pattern.search(text)
    if not match:
        return {}
    values = re.findall(DO_FLOAT_RE, match.group(1))
    return {i: float(v) for i, v in enumerate(values[:count])}


def extract_do_sensor_page_serial(text: str) -> str | None:
    match = AADI_SERIAL_RE.search(text)
    return match.group(1).strip() if match else None


def extract_do_sensor(pages_text: list[str], target_serial: str | None = None) -> dict:
    coefficients: dict[str, float | str] = {}
    dates_found: list[date] = []
    foil_batch: str | None = None
    recognized_any_page = False
    other_serials_seen: set[str] = set()
    normalized_target = target_serial.strip().casefold() if target_serial else None

    for text in pages_text:
        upper = text.upper()
        if not any(marker in upper for marker in AADI_PAGE_MARKERS):
            continue
        form = classify_aadi_form(text)
        if form is None:
            # AADI page, but not a calibration cert (e.g. the Form 784
            # production-test sheet) -- skip, don't disqualify the file.
            continue

        page_serial = extract_do_sensor_page_serial(text)
        if normalized_target is not None:
            # Can't verify this page belongs to the target asset -- skip
            # rather than risk mixing another sensor's coefficients in.
            if page_serial is None:
                continue
            if page_serial.strip().casefold() != normalized_target:
                other_serials_seen.add(page_serial)
                continue

        recognized_any_page = True

        for prefix, (label, count) in DO_COEF_ROWS.items():
            for index, value in extract_coef_row(text, label, count).items():
                coefficients[f"{prefix}{index}"] = value

        date_match = AADI_CAL_DATE_RE.search(text)
        if date_match:
            try:
                dates_found.append(
                    dateparser.parse(date_match.group(1), dayfirst=True).date()
                )
            except (ValueError, OverflowError):
                pass

        if foil_batch is None:
            for pattern in AADI_FOIL_BATCH_RES:
                match = pattern.search(text)
                if match:
                    foil_batch = match.group(1)
                    break

    if not recognized_any_page:
        if other_serials_seen:
            return {
                "recognized": False,
                "reason": (
                    f"This certificate covers serial number(s) "
                    f"{', '.join(sorted(other_serials_seen))}, not this asset's "
                    f"serial ({target_serial}) -- enter the coefficients manually."
                ),
            }
        return {
            "recognized": False,
            "reason": "Could not identify a known sensor model/calibration facility combination from this certificate.",
        }
    if not dates_found:
        return {
            "recognized": False,
            "reason": "Identified this as an AADI optode certificate, but couldn't find a calibration date on it.",
        }
    if not coefficients:
        return {
            "recognized": False,
            "reason": "Identified this as an AADI optode certificate, but couldn't find any coefficients on it.",
        }

    if foil_batch:
        coefficients["foil_batch"] = foil_batch

    return {
        "recognized": True,
        "model": "aadi_optode",
        "facility": "AADI",
        "calDate": min(dates_found).isoformat(),
        "coefficients": coefficients,
    }


# --- WET Labs ECO Puck (eco_sensor) ------------------------------------
#
# WET Labs prints one channel per page (a standalone PDF, before
# Fiona's own workflow concatenates the separate per-channel files into
# one upload): "Scattering Meter Calibration Sheet" for a backscatter
# wavelength, "ECO <Channel> Fluorometer Characterization Sheet" for
# chlorophyll/CDOM, presumably similar for turbidity. So one uploaded
# file can (and for a BB2-type sensor, does) contain more than one
# channel's page -- handled the same page-by-page way as AADI/RBR above.
#
# A BB2 sensor reports two backscatter wavelengths on two otherwise
# identical-layout pages. There's no reliable in-document channel label
# ("channel 1" vs "channel 2") to key off, so pages are assigned by
# wavelength value instead: the lower wavelength (e.g. 470nm) becomes
# bb_*, the higher (e.g. 700nm) becomes bb2_* -- sorted, not by upload
# order, so it doesn't matter which PDF got concatenated first.
#
# Only chlorophyll and scattering are recognized so far, confirmed
# against real certificates for SN 870 (BB2FLVMT-870, 2011-10-28).
# CDOM and turbidity charsheets are expected to share the same
# "Characterization Sheet" layout (dark counts/scale factor/maximum
# output/resolution/ambient temperature) -- add their title regex and
# field set to WET_LABS_CHAR_SHEET_CHANNELS once confirmed against a
# real one; turbidity in particular has an extra NTU-scale-factor field
# (turb_ntu_sv) not modeled by the generic field set below, so it isn't
# just a drop-in title addition.
#
# WET Labs' own "S/N" field prints the model-prefixed string
# ("BB2FLVMT-870"), but OGDB stores just the bare serial ("870") -- see
# normalize_wetlabs_serial.
WET_LABS_DATE_RE = re.compile(r"\b(\d{1,2}/\d{1,2}/\d{4})\b")
WET_LABS_SERIAL_RE = re.compile(r"S/N:?\s*(\S+)")
WET_LABS_WAVELENGTH_RE = re.compile(r"Wavelength:\s*(\d+)")
WET_LABS_BB_SF_RE = re.compile(
    rf"Scale Factor for \d+\s*nm\s*=\s*({DO_FLOAT_RE}|[-+]?\d+\.?\d*)",
    re.IGNORECASE,
)
WET_LABS_BB_DC_RE = re.compile(
    r"Dark Counts\s*=\s*([-+]?\d+\.?\d*)\s*counts", re.IGNORECASE
)
WET_LABS_BB_RES_RE = re.compile(
    rf"Instrument Resolution\s*=\s*([-+]?\d+\.?\d*)\s*counts\s*({DO_FLOAT_RE}|[-+]?\d+\.?\d*)",
    re.IGNORECASE,
)

# channel column prefix -> (title regex identifying the page, {column
# suffix: value regex}). Each channel gets its own field set rather than
# one shared across all of them, since turbidity's extra field
# (turb_ntu_sv) won't fit the others' shape.
WET_LABS_CHAR_SHEET_CHANNELS: dict[str, tuple[re.Pattern, dict[str, re.Pattern]]] = {
    "chla": (
        re.compile(r"ECO Chlorophyll Fluorometer Characterization Sheet", re.IGNORECASE),
        {
            "dc": re.compile(r"Dark [Cc]ounts\s*[:=]?\s*([-+]?\d+\.?\d*)\s*counts", re.IGNORECASE),
            "sf": re.compile(rf"Scale Factor \(SF\)\s*({DO_FLOAT_RE}|[-+]?\d+\.?\d*)", re.IGNORECASE),
            "maxoutput": re.compile(r"Maximum Output\s+([-+]?\d+\.?\d*)", re.IGNORECASE),
            "res": re.compile(r"\bResolution\s+([-+]?\d+\.?\d*)\s*counts", re.IGNORECASE),
            "cal_temp": re.compile(
                r"Ambient temperature during characterization\s+([-+]?\d+\.?\d*)", re.IGNORECASE
            ),
        },
    ),
}


def normalize_wetlabs_serial(raw: str) -> str:
    return raw.rsplit("-", 1)[-1].strip()


def extract_eco_sensor(pages_text: list[str], target_serial: str | None = None) -> dict:
    coefficients: dict[str, float] = {}
    dates_found: list[date] = []
    bb_channels: list[tuple[float, float, float, float | None, float | None]] = []
    recognized_any_page = False
    other_serials_seen: set[str] = set()
    normalized_target = target_serial.strip().casefold() if target_serial else None

    def serial_matches(text: str) -> bool:
        if normalized_target is None:
            return True
        serial_match = WET_LABS_SERIAL_RE.search(text)
        if not serial_match:
            return True  # can't verify -- don't block on a missing S/N field
        page_serial = normalize_wetlabs_serial(serial_match.group(1))
        if page_serial.casefold() == normalized_target:
            return True
        other_serials_seen.add(page_serial)
        return False

    for text in pages_text:
        if "SCATTERING METER CALIBRATION SHEET" in text.upper():
            if not serial_matches(text):
                continue
            recognized_any_page = True
            wl_match = WET_LABS_WAVELENGTH_RE.search(text)
            sf_match = WET_LABS_BB_SF_RE.search(text)
            dc_match = WET_LABS_BB_DC_RE.search(text)
            res_match = WET_LABS_BB_RES_RE.search(text)
            if wl_match and sf_match and dc_match:
                bb_channels.append((
                    float(wl_match.group(1)),
                    float(sf_match.group(1)),
                    float(dc_match.group(1)),
                    float(res_match.group(1)) if res_match else None,
                    float(res_match.group(2)) if res_match else None,
                ))
            date_match = WET_LABS_DATE_RE.search(text)
            if date_match:
                try:
                    dates_found.append(
                        dateparser.parse(date_match.group(1), dayfirst=False).date()
                    )
                except (ValueError, OverflowError):
                    pass
            continue

        for prefix, (title_re, field_res) in WET_LABS_CHAR_SHEET_CHANNELS.items():
            if not title_re.search(text):
                continue
            if not serial_matches(text):
                break
            recognized_any_page = True
            for suffix, field_re in field_res.items():
                match = field_re.search(text)
                if match:
                    coefficients[f"{prefix}_{suffix}"] = float(match.group(1))
            date_match = WET_LABS_DATE_RE.search(text)
            if date_match:
                try:
                    dates_found.append(
                        dateparser.parse(date_match.group(1), dayfirst=False).date()
                    )
                except (ValueError, OverflowError):
                    pass
            break

    if not recognized_any_page:
        if other_serials_seen:
            return {
                "recognized": False,
                "reason": (
                    f"This certificate covers serial number(s) "
                    f"{', '.join(sorted(other_serials_seen))}, not this asset's "
                    f"serial ({target_serial}) -- enter the coefficients manually."
                ),
            }
        return {
            "recognized": False,
            "reason": "Could not identify a known sensor model/calibration facility combination from this certificate.",
        }

    if len(bb_channels) > 2:
        return {
            "recognized": False,
            "reason": (
                f"Found {len(bb_channels)} backscatter wavelength pages in this "
                "certificate -- expected at most 2 (bb/bb2). Enter manually."
            ),
        }
    bb_channels.sort(key=lambda c: c[0])
    for (wl, sf, dc, res_counts, res_sf), col_prefix in zip(bb_channels, ("bb", "bb2")):
        coefficients[f"{col_prefix}_wl"] = wl
        coefficients[f"{col_prefix}_sf"] = sf
        coefficients[f"{col_prefix}_dc"] = dc
        if res_counts is not None:
            coefficients[f"{col_prefix}_res_counts"] = res_counts
        if res_sf is not None:
            coefficients[f"{col_prefix}_res_sf"] = res_sf

    if not dates_found:
        return {
            "recognized": False,
            "reason": "Identified this as a WET Labs ECO certificate, but couldn't find a calibration date on it.",
        }
    if not coefficients:
        return {
            "recognized": False,
            "reason": "Identified this as a WET Labs ECO certificate, but couldn't find any coefficients on it.",
        }

    return {
        "recognized": True,
        "model": "eco_puck",
        "facility": "WET Labs",
        "calDate": min(dates_found).isoformat(),
        "coefficients": coefficients,
    }


def is_eco_sensor_page(text: str) -> bool:
    upper = text.upper()
    if "SCATTERING METER CALIBRATION SHEET" in upper:
        return True
    return any(title_re.search(text) for title_re, _ in WET_LABS_CHAR_SHEET_CHANNELS.values())


def extract(pdf_bytes: bytes, target_serial: str | None = None) -> dict:
    with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
        pages_text = [page.extract_text() or "" for page in pdf.pages]
    full_text = "\n".join(pages_text)

    # A scanned/image-only PDF (no embedded text layer at all) looks
    # identical to "we don't recognize this format" further down --
    # pdfplumber has no OCR, so every page comes back empty regardless of
    # what the cert actually is. Distinguishing this case avoids sending
    # someone chasing a phantom "add support for my sensor" gap when the
    # real issue is that this specific PDF has no extractable text (seen
    # firsthand: an older WEBB Glider cert scanned as one full-page image
    # per page, vs. a newer one from the same vendor with real text).
    if full_text.strip() == "":
        return {
            "recognized": False,
            "reason": (
                "This PDF has no extractable text (likely a scanned image, "
                "not a native digital document) -- enter the coefficients "
                "manually."
            ),
        }

    if any(
        any(marker in text.upper() for marker in AADI_PAGE_MARKERS)
        for text in pages_text
    ):
        return extract_do_sensor(pages_text, target_serial)

    if any(is_eco_sensor_page(text) for text in pages_text):
        return extract_eco_sensor(pages_text, target_serial)

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
    # Optional argv[1]: the target asset's serial number, passed by
    # CertificateParserService so multi-sensor AADI bundles (see
    # extract_do_sensor's Form 830 note) extract only the matching
    # sensor's pages instead of merging every sensor found in the file.
    target_serial = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else None
    pdf_bytes = sys.stdin.buffer.read()
    try:
        result = extract(pdf_bytes, target_serial)
    except Exception as exc:  # noqa: BLE001 -- always return JSON, never a raw traceback
        result = {"recognized": False, "reason": f"Failed to read this PDF: {exc}"}
    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
