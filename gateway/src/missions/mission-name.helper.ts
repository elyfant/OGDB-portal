// mission_name = {glider}_{project}_{site}_{mmmyyyy}, e.g.
// "durin_naco_svinoy_may2026" -- checked every real project/site/glider
// name in ogdb-test and none contain non-ASCII characters (Norwegian
// names are already stored plain-ASCII, e.g. "Svinoy" not "Svinøy"), so
// a straight lowercase + strip-non-alphanumeric is sufficient; no
// transliteration step needed. Hardcoded month abbreviations rather than
// toLocaleString to avoid depending on the server's ICU data.
const MONTH_ABBR = [
	"jan",
	"feb",
	"mar",
	"apr",
	"may",
	"jun",
	"jul",
	"aug",
	"sep",
	"oct",
	"nov",
	"dec",
];

function slugPart(value: string): string {
	return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function buildMissionName(
	gliderName: string,
	projectName: string,
	siteName: string,
	launchDate: string,
): string {
	const date = new Date(launchDate);
	const mmmyyyy = `${MONTH_ABBR[date.getUTCMonth()]}${date.getUTCFullYear()}`;
	return [gliderName, projectName, siteName, mmmyyyy].map(slugPart).join("_");
}
