import type { DiagramSpec } from "./layout";
import { SEAGLIDER_M2 } from "./seaglider-m2";
import { SLOCUM_G3 } from "./slocum-g3";

// Which drawing, if any, a glider gets. Keyed on the platform's name and
// model as OGDB's platforms table has them. The portal lists the fleet's
// Seagliders as "M1"; the drawing covers M1 and M2 alike. The SGX is a
// different glider with no drawing yet.
export function diagramSpecFor(
	platform: string | null,
	model: string | null,
): DiagramSpec | null {
	if (platform === "slocum") return SLOCUM_G3;
	if (platform === "seaglider" && /^M[12]$/i.test((model ?? "").trim())) {
		return SEAGLIDER_M2;
	}
	return null;
}
