#!/usr/bin/env python3
"""Turn the glider-parts PowerPoint into SVG parts + a slot layout.

Usage:
    python3 dashboard/scripts/pptx_to_glider_parts.py "gliders3 (1).pptx"

The deck has two slides, and this script relies on that convention:
  * slide 1: every part drawn separately (and to the proportions we want),
  * slide 2: the same parts assembled into a Slocum G3.

Writes, under dashboard/src/lib/glider-diagram/slocum-g3/:
  * <part>.svg           -- each part on its own, to open/inspect/edit
  * parts.generated.ts   -- the same parts as inline markup, plus where each
                            slot sits on slide 2 (the reference layout)

All coordinates are in "deck units": 1/100 inch (EMU / 9144).

Only the preset shapes the deck actually uses are supported (rect,
roundRect, ellipse, rtTriangle, parallelogram, straight connectors); the
script fails loudly on anything else rather than drawing it wrong.
Standard library only.
"""

import colorsys
import json
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
}
A = "{%s}" % NS["a"]
EMU_PER_UNIT = 9144

# --- The human knowledge: which shapes make up which part -------------------

# part id -> top-level shape names on SLIDE 1 (the separate parts).
PARTS = {
    "hull_L": ["Rectangle 3"],  # ASSY G-1405-L
    "hull_1": ["Rectangle 5"],  # ASSY G-1405-1
    "battery_pitch": ["Group 11"],
    "battery_aft": ["Group 40"],
    "altimeter": ["Group 17"],
    "payload_bay": ["Rectangle 26"],
    "forward_section": ["Group 24"],
    "energy_bay": ["Group 77"],
    "aft_section": ["Rectangle 44"],
    "end_cap": ["Group 62"],
    "ct_sensor": [
        "Rectangle: Rounded Corners 64",
        "Oval 65",
        "Rectangle 66",
    ],
    "do_sensor": ["Rectangle: Rounded Corners 69", "Rectangle 70"],
}

# The altimeter is a full circle with a white rectangle laid over its right
# half to cut it into a nose. Render it as a clip instead, so the part has
# no white box on a dark theme: the part is cut at the mask's left edge.
MASKED_BY = {"altimeter": "Rectangle 18"}

# slot key -> (part id, top-level shape name on SLIDE 2 where it's placed).
SLOTS = {
    "nose": ("altimeter", "Group 17"),
    "fore_hull": ("hull_L", "Rectangle 3"),
    "energy_hull": ("hull_1", "Rectangle 5"),
    "payload_bay": ("payload_bay", "Rectangle 26"),
    "aft_hull": ("hull_L", "Rectangle 37"),
    "end_cap": ("end_cap", "Group 62"),
    "forward_section": ("forward_section", "Group 24"),
    "pitch_battery": ("battery_pitch", "Group 11"),
    "energy_bay": ("energy_bay", "Group 51"),
    "energy_battery": ("battery_pitch", "Group 31"),
    "ct_sensor": ("ct_sensor", "Group 1"),
    "aft_section": ("aft_section", "Rectangle 44"),
    "aft_battery": ("battery_aft", "Group 40"),
    "do_sensor": ("do_sensor", "Group 2"),
}

# --- Theme colours -----------------------------------------------------------


def load_theme(z):
    root = ET.fromstring(z.read("ppt/theme/theme1.xml"))
    scheme = root.find(".//a:clrScheme", NS)
    out = {}
    for el in scheme:
        name = el.tag.split("}")[1]
        c = el[0]
        out[name] = c.get("val") if c.tag == A + "srgbClr" else c.get("lastClr")
    # Slide colour names -> theme slots.
    out.update(
        tx1=out["dk1"], bg1=out["lt1"], tx2=out["dk2"], bg2=out["lt2"]
    )
    return out


def resolve_color(el, theme):
    """<a:srgbClr>/<a:schemeClr> with lumMod/lumOff/shade/tint -> '#rrggbb'."""
    base = el.get("val")
    hexv = base if el.tag == A + "srgbClr" else theme[base]
    r, g, b = (int(hexv[i : i + 2], 16) / 255 for i in (0, 2, 4))
    for t in el:
        k = t.tag.split("}")[1]
        v = int(t.get("val")) / 100000
        if k in ("lumMod", "lumOff"):
            h, l, s = colorsys.rgb_to_hls(r, g, b)
            l = l * v if k == "lumMod" else l + v
            r, g, b = colorsys.hls_to_rgb(h, min(max(l, 0), 1), s)
        elif k == "shade":
            r, g, b = r * v, g * v, b * v
        elif k == "tint":
            r, g, b = (1 - (1 - c) * v for c in (r, g, b))
        elif k not in ("alpha",):
            raise SystemExit(f"unsupported colour transform: {k}")
    return "#%02x%02x%02x" % tuple(round(c * 255) for c in (r, g, b))


def line_widths(z):
    root = ET.fromstring(z.read("ppt/theme/theme1.xml"))
    return [int(ln.get("w")) for ln in root.find(".//a:lnStyleLst", NS)]


# --- Shapes ------------------------------------------------------------------


class Box:
    def __init__(self, x, y, w, h):
        self.x, self.y, self.w, self.h = x, y, w, h


def xfrm_box(xf):
    o, e = xf.find("a:off", NS), xf.find("a:ext", NS)
    return Box(int(o.get("x")), int(o.get("y")), int(e.get("cx")), int(e.get("cy")))


def fmt(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def shape_style(sp, theme, widths):
    spPr = sp.find("p:spPr", NS)
    style = sp.find("p:style", NS)
    fill = "none"
    sf = spPr.find("a:solidFill", NS)
    if sf is not None:
        fill = resolve_color(sf[0], theme)
    elif spPr.find("a:noFill", NS) is not None:
        fill = "none"
    elif style is not None:
        ref = style.find("a:fillRef", NS)
        if int(ref.get("idx")) > 0:
            fill = resolve_color(ref[0], theme)
    stroke, sw = "none", 0.0
    ln = spPr.find("a:ln", NS)
    lnref = style.find("a:lnRef", NS) if style is not None else None
    if ln is not None and ln.find("a:noFill", NS) is not None:
        pass
    else:
        color_el = None
        width = None
        if ln is not None and ln.find("a:solidFill", NS) is not None:
            color_el = ln.find("a:solidFill", NS)[0]
        elif lnref is not None and int(lnref.get("idx")) > 0:
            color_el = lnref[0]
        if ln is not None and ln.get("w"):
            width = int(ln.get("w"))
        elif lnref is not None and int(lnref.get("idx")) > 0:
            width = widths[int(lnref.get("idx")) - 1]
        if color_el is not None and width:
            stroke, sw = resolve_color(color_el, theme), width / EMU_PER_UNIT
    return fill, stroke, sw


def adj(sp, name, default):
    for gd in sp.iter(A + "gd"):
        if gd.get("name") == name:
            return int(gd.get("fmla").split()[1])
    return default


def emit_shape(sp, box, theme, widths, origin):
    """SVG element for one sp/cxnSp, given its absolute box in EMU."""
    ox, oy = origin
    x, y = (box.x - ox) / EMU_PER_UNIT, (box.y - oy) / EMU_PER_UNIT
    w, h = box.w / EMU_PER_UNIT, box.h / EMU_PER_UNIT
    geom = sp.find("p:spPr/a:prstGeom", NS)
    prst = geom.get("prst")
    fill, stroke, sw = shape_style(sp, theme, widths)
    xf = sp.find("p:spPr/a:xfrm", NS)
    attrs = f'fill="{fill}" stroke="{stroke}"' + (
        f' stroke-width="{fmt(sw)}"' if stroke != "none" else ""
    )
    if xf.get("rot"):
        deg = int(xf.get("rot")) / 60000
        attrs += f' transform="rotate({fmt(deg)} {fmt(x + w / 2)} {fmt(y + h / 2)})"'
    fh, fv = xf.get("flipH") == "1", xf.get("flipV") == "1"
    if prst == "rect":
        return f'<rect x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(h)}" {attrs}/>'
    if prst == "roundRect":
        r = min(w, h) * adj(sp, "adj", 16667) / 100000
        return (
            f'<rect x="{fmt(x)}" y="{fmt(y)}" width="{fmt(w)}" height="{fmt(h)}" '
            f'rx="{fmt(r)}" {attrs}/>'
        )
    if prst == "ellipse":
        return (
            f'<ellipse cx="{fmt(x + w / 2)}" cy="{fmt(y + h / 2)}" '
            f'rx="{fmt(w / 2)}" ry="{fmt(h / 2)}" {attrs}/>'
        )
    if prst == "rtTriangle":
        pts = [(x, y + h), (x, y), (x + w, y + h)]
    elif prst == "parallelogram":
        off = min(w, h) * adj(sp, "adj", 25000) / 100000
        pts = [(x, y + h), (x + off, y), (x + w, y), (x + w - off, y + h)]
    elif prst == "straightConnector1":
        x1, x2 = (x + w, x) if fh else (x, x + w)
        y1, y2 = (y + h, y) if fv else (y, y + h)
        return (
            f'<line x1="{fmt(x1)}" y1="{fmt(y1)}" x2="{fmt(x2)}" y2="{fmt(y2)}" {attrs}/>'
        )
    else:
        raise SystemExit(f"unsupported preset shape: {prst}")
    p = " ".join(f"{fmt(px)},{fmt(py)}" for px, py in pts)
    return f'<polygon points="{p}" {attrs}/>'


def flatten(el, theme, widths, group=None):
    """Yield (sp, absolute Box in EMU) for every drawable under el, in z-order."""
    for child in el:
        tag = child.tag.split("}")[1]
        if tag == "grpSp":
            pr = child.find("p:grpSpPr/a:xfrm", NS)
            if pr.get("rot"):
                raise SystemExit("rotated groups are not supported")
            g = xfrm_box(pr)
            c = Box(
                int(pr.find("a:chOff", NS).get("x")),
                int(pr.find("a:chOff", NS).get("y")),
                int(pr.find("a:chExt", NS).get("cx")),
                int(pr.find("a:chExt", NS).get("cy")),
            )
            yield from flatten(child, theme, widths, (g, c, group))
        elif tag in ("sp", "cxnSp"):
            xf = child.find("p:spPr/a:xfrm", NS)
            if xf is None:
                continue
            b = xfrm_box(xf)
            if tag == "sp" and child.find("p:txBody", NS) is not None:
                if "".join(t.text or "" for t in child.iter(A + "t")).strip():
                    continue  # a text label, not part artwork
            g = group
            while g:  # map child space -> slide space, innermost group first
                grp, ch, outer = g
                sx, sy = grp.w / ch.w, grp.h / ch.h
                b = Box(
                    grp.x + (b.x - ch.x) * sx,
                    grp.y + (b.y - ch.y) * sy,
                    b.w * sx,
                    b.h * sy,
                )
                g = outer
            yield child, b


def top_level(slide_root):
    tree = slide_root.find(".//p:spTree", NS)
    out = {}
    for el in tree:
        tag = el.tag.split("}")[1]
        if tag not in ("sp", "cxnSp", "grpSp"):
            continue
        name = el.find(".//p:cNvPr", NS).get("name")
        if tag == "grpSp":
            box = xfrm_box(el.find("p:grpSpPr/a:xfrm", NS))
        else:
            box = xfrm_box(el.find("p:spPr/a:xfrm", NS))
        # A name can repeat (text boxes); only drawable duplicates matter,
        # and the deck keeps those unique.
        out.setdefault(name, (el, box))
    return out


def union(boxes):
    x0 = min(b.x for b in boxes)
    y0 = min(b.y for b in boxes)
    x1 = max(b.x + b.w for b in boxes)
    y1 = max(b.y + b.h for b in boxes)
    return Box(x0, y0, x1 - x0, y1 - y0)


def flatten_top(el, theme, widths):
    # flatten() walks an element's *children*, so wrap the shape/group in a
    # parent to reuse the same path (and apply the group's own transform).
    wrapper = ET.Element("wrapper")
    wrapper.append(el)
    return list(flatten(wrapper, theme, widths))


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    z = zipfile.ZipFile(sys.argv[1])
    theme, widths = load_theme(z), line_widths(z)
    s1 = top_level(ET.fromstring(z.read("ppt/slides/slide1.xml")))
    s2 = top_level(ET.fromstring(z.read("ppt/slides/slide2.xml")))

    out_dir = Path(__file__).resolve().parent.parent / "src/lib/glider-diagram/slocum-g3"
    out_dir.mkdir(parents=True, exist_ok=True)

    parts = {}
    for part_id, names in PARTS.items():
        drawn = []
        for n in names:
            drawn.extend(flatten_top(s1[n][0], theme, widths))
        # Size the part from the deck's own top-level boxes, not from its
        # children: PowerPoint keeps a group's extent tight to what is
        # actually drawn, whereas a rotated child's stored box is its
        # unrotated frame and would overstate the part.
        bbox = union([s1[n][1] for n in names])
        clip_w = None
        if part_id in MASKED_BY:
            mask_left = s1[MASKED_BY[part_id]][1].x
            clip_w = mask_left - bbox.x
            bbox = Box(bbox.x, bbox.y, clip_w, bbox.h)
        origin = (bbox.x, bbox.y)
        body = [emit_shape(sp, b, theme, widths, origin) for sp, b in drawn]
        w, h = bbox.w / EMU_PER_UNIT, bbox.h / EMU_PER_UNIT
        inner = "".join(body)
        if clip_w is not None:
            cid = f"clip-{part_id}"
            inner = (
                f'<clipPath id="{cid}"><rect x="0" y="0" width="{fmt(w)}" '
                f'height="{fmt(h)}"/></clipPath><g clip-path="url(#{cid})">{inner}</g>'
            )
        parts[part_id] = (w, h, inner, bbox)
        pad = 2
        (out_dir / f"{part_id}.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="{-pad} {-pad} {fmt(w + 2 * pad)} {fmt(h + 2 * pad)}" '
            f'width="{fmt(w + 2 * pad)}" height="{fmt(h + 2 * pad)}">{inner}</svg>\n'
        )

    layout = {}
    for slot, (part_id, shape_name) in SLOTS.items():
        el, box = s2[shape_name]
        # Group boxes on slide 2 are the group's own extent, which equals the
        # part's bbox because the slide-2 group is a copy of the slide-1 one.
        layout[slot] = (part_id, box.x / EMU_PER_UNIT, box.y / EMU_PER_UNIT)

    lines = [
        "// GENERATED by dashboard/scripts/pptx_to_glider_parts.py -- do not edit.",
        "// Re-run the script on the updated deck to regenerate. (Excluded from Biome in",
        "// biome.json, since the generator writes long single-line strings.)",
        "",
        "export interface DiagramPart {",
        "\t/** Size in deck units (1/100 inch). */",
        "\twidth: number;",
        "\theight: number;",
        "\t/** SVG markup, origin at the part's top-left. */",
        "\tsvg: string;",
        "}",
        "",
        "export const PARTS: Record<string, DiagramPart> = {",
    ]
    for pid, (w, h, inner, _) in parts.items():
        lines.append(
            f"\t{pid}: {{ width: {fmt(w)}, height: {fmt(h)}, svg: {json.dumps(inner)} }},"
        )
    lines += [
        "};",
        "",
        "/** Where each slot sits on the deck's assembled slide (the reference layout). */",
        "export const REFERENCE_LAYOUT: Record<string, { part: string; x: number; y: number }> = {",
    ]
    for slot, (pid, x, y) in layout.items():
        lines.append(f'\t{slot}: {{ part: "{pid}", x: {fmt(x)}, y: {fmt(y)} }},')
    lines.append("};")
    (out_dir / "parts.generated.ts").write_text("\n".join(lines) + "\n")
    print(f"wrote {len(parts)} parts and {len(layout)} slots to {out_dir}")


if __name__ == "__main__":
    main()
