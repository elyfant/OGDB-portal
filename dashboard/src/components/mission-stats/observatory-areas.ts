// Broad regional grouping for OGDB's `observatory` values, agreed with the OGDF
// team -- keeps the deployment timeline to a handful of rows instead of
// one per individual observatory. Keyed lowercase so matching is case-insensitive
// against however an observatory ended up stored.
const OBSERVATORY_AREAS: Record<string, string> = {
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

// Observatories not yet in the table above (new observatory names as the fleet expands
// into new regions) fall in here rather than disappearing from the chart.
export const OTHER_AREA = "Other";

export function observatoryToArea(observatory: string | null): string {
	if (!observatory) return OTHER_AREA;
	return OBSERVATORY_AREAS[observatory.trim().toLowerCase()] ?? OTHER_AREA;
}
