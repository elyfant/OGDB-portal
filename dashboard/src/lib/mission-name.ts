// Live preview mirror of gateway's missions/mission-name.helper.ts --
// duplicated because gateway and dashboard don't share a runtime module
// (only @ogdb/types is shared). The server always computes the real,
// authoritative mission_name on save; this is only for showing the
// Add Mission dialog's live "here's what it'll be called" preview
// before that happens. Keep the two in sync by hand.
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

export function previewMissionName(
	gliderName: string | null,
	projectName: string | null,
	siteName: string | null,
	launchDate: string | null,
): string | null {
	if (!gliderName || !projectName || !siteName || !launchDate) return null;
	const date = new Date(launchDate);
	if (Number.isNaN(date.getTime())) return null;
	const mmmyyyy = `${MONTH_ABBR[date.getUTCMonth()]}${date.getUTCFullYear()}`;
	return [gliderName, projectName, siteName, mmmyyyy].map(slugPart).join("_");
}
