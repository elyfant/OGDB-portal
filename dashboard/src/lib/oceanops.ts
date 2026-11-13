// Builds the link to a mission's platform page on OceanOPS from its
// Passport ID (missions.wigos_id), so nobody has to store the OceanOPS
// "Reference" separately.
//
// A Passport ID is a WIGOS Station Identifier: series-issuer-issue-localId,
// e.g. 0-22000-2-6801620. For a glider the local id is its WMO number and
// the issue number counts that glider's missions. OceanOPS's Reference is
// the same two pieces rearranged. A glider's first mission (issue 0) is
// the bare WMO number; later ones add _<issue, zero-padded to 3 digits>:
//
//   0-22000-0-6801620  ->  6801620
//   0-22000-2-6801620  ->  6801620_002
//   https://www.ocean-ops.org/board/wa/Platform?ref=6801620_002
//
// Both forms were checked against OceanOPS for glider 6801620 (2026-11).
// Returns null for anything that isn't a four-block WSI, so the caller
// shows plain text rather than a broken link.
const OCEANOPS_PLATFORM_URL = "https://www.ocean-ops.org/board/wa/Platform";

export function oceanOpsReference(
	wigosId: string | null | undefined,
): string | null {
	if (!wigosId) return null;
	const parts = wigosId.trim().split("-");
	if (parts.length !== 4) return null;
	const [, , issue, localId] = parts;
	if (!/^\d+$/.test(issue) || !/^[A-Za-z0-9]+$/.test(localId)) return null;
	if (Number(issue) === 0) return localId;
	return `${localId}_${issue.padStart(3, "0")}`;
}

export function oceanOpsPlatformUrl(
	wigosId: string | null | undefined,
): string | null {
	const ref = oceanOpsReference(wigosId);
	return ref ? `${OCEANOPS_PLATFORM_URL}?ref=${encodeURIComponent(ref)}` : null;
}
