import type { Glider } from "@ogdb/types";

// Display rules for a glider's location, shared by the fleet table, the
// glider header and the status box so they all read the same. See
// docs/design/glider-state-and-location.md section 5.
//
// Location is a recorded, OPTIONAL fact (no shelves, just a place and the
// date it was recorded). "Not recorded" is a normal answer -- a recovered
// glider nobody has updated yet -- so it is shown quietly, not as an error.

type LocationFields = Pick<
	Glider,
	"location" | "locationSince" | "locationSource"
>;

export const NOT_RECORDED = "Not recorded";

// "12 Jun", or "12 Jun 2025" when it isn't this year.
export function shortDate(value: string): string {
	const d = new Date(value);
	const sameYear = d.getFullYear() === new Date().getFullYear();
	return d.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		...(sameYear ? {} : { year: "numeric" }),
	});
}

// Just the place: "Bergen lab", "At sea", "Unknown", "Not recorded", or "—"
// (destroyed: nowhere).
export function locationName(g: LocationFields): string {
	switch (g.locationSource) {
		case "at_sea":
		case "unknown":
		case "recorded":
			return g.location ?? "—";
		case "none":
			return "—";
		default:
			return NOT_RECORDED;
	}
}

// True when there is a real place to show (so the UI can grey out the rest).
export function hasLocation(g: LocationFields): boolean {
	return (
		g.locationSource === "at_sea" ||
		g.locationSource === "unknown" ||
		g.locationSource === "recorded"
	);
}

// "Bergen lab · (since 12 Jun)". No finer detail than that, by design.
export function locationText(g: LocationFields): string {
	const name = locationName(g);
	if (hasLocation(g) && g.locationSince) {
		return `${name} · (since ${shortDate(g.locationSince)})`;
	}
	return name;
}
