// Broad regional grouping for OGDB's `site` values, agreed with the OGDF
// team -- keeps the deployment timeline to a handful of rows instead of
// one per individual site. Keyed lowercase so matching is case-insensitive
// against however a site ended up stored.
const SITE_AREAS: Record<string, string> = {
	svinoy: "Norwegian Sea",
	norwegian: "Norwegian Sea",
	faroe: "Norwegian Sea",

	lofoten: "Lofoten",
	gimsoy: "Lofoten",

	iceland: "Iceland Sea",
	mohn: "Iceland Sea",

	greenland: "Greenland Sea",

	barents: "Barents Sea",
	porsangerfjorden: "Barents Sea",

	wsc: "Svalbard / Fram Strait",
	svalbard: "Svalbard / Fram Strait",
	northsvalbard: "Svalbard / Fram Strait",
	fram: "Svalbard / Fram Strait",

	baffin: "Baffin Bay",

	dml: "Antarctic / Southern Ocean",
	sop: "Antarctic / Southern Ocean",

	mediterranean: "Mediterranean",

	masfjorden: "West Norway",
	hornindalsvatn: "West Norway",
};

// Sites not yet in the table above (new site names as the fleet expands
// into new regions) fall in here rather than disappearing from the chart.
export const OTHER_AREA = "Other";

export function siteToArea(site: string | null): string {
	if (!site) return OTHER_AREA;
	return SITE_AREAS[site.trim().toLowerCase()] ?? OTHER_AREA;
}
