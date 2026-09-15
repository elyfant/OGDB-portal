import { formatDate } from "@/lib/format";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status-meta";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import type { AssetStatus } from "@ogdb/types";

function daysSince(date: string): number {
	const ms = Date.now() - new Date(date).getTime();
	return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

const SOURCE_LABEL: Record<string, string> = {
	mission: "from an active mission",
	service_event: "from a logged event",
	default: "nothing logged — assumed in the lab",
};

// "Lab" is the derived-status fallback whenever there's no open mission
// and no open qualifying service event -- it's a guess, not a fact, so
// the "nothing logged" wording is accurate for a glider that's just
// sitting unused. It stops being accurate once the asset is retired
// *with a reason on record* (decommissionedDate/-Reason): something
// real IS logged, it's just not one of the events this derivation looks
// at (missions/service events, not decommission). Saying "nothing
// logged" one line above "Retired ... <reason>" reads as a flat
// contradiction, so this bucket gets its own wording instead.
const RETIRED_DEFAULT_LABEL = "no activity logged since retirement";

function sourceLabel(source: string | null, isRetired: boolean): string {
	if (source === "default" && isRetired) return RETIRED_DEFAULT_LABEL;
	return SOURCE_LABEL[source ?? "default"];
}

// Operational status is derived from the glider's timeline; fleet
// lifecycle (retired or not) is a separate axis shown alongside. See
// docs/design/derived-glider-status.md.
export default function GliderStatusBox({
	status,
	statusSince,
	statusSource,
	decommissionedDate,
	decommissionReason,
}: {
	status: AssetStatus | null;
	statusSince: string | null;
	statusSource: "mission" | "service_event" | "default" | null;
	decommissionedDate: string | null;
	decommissionReason: string | null;
}) {
	if (!status) {
		return <Typography color="text.disabled">Status not set.</Typography>;
	}

	return (
		<Box
			sx={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}
		>
			<Chip
				label={STATUS_LABEL[status]}
				color={STATUS_COLOR[status]}
				sx={{ fontSize: "1rem", py: 2.5, px: 1 }}
			/>
			{decommissionedDate && (
				<Chip label="Retired" variant="outlined" sx={{ py: 2.5, px: 1 }} />
			)}
			<Box>
				<Typography variant="body2" color="text.secondary">
					{statusSince ? (
						<>
							Since {formatDate(statusSince)} ({daysSince(statusSince)}{" "}
							{daysSince(statusSince) === 1 ? "day" : "days"})
						</>
					) : (
						sourceLabel(statusSource, !!decommissionedDate)
					)}
				</Typography>
				{statusSince && statusSource && SOURCE_LABEL[statusSource] && (
					<Typography variant="caption" color="text.disabled">
						{sourceLabel(statusSource, !!decommissionedDate)}
					</Typography>
				)}
				{decommissionedDate && (
					<Typography variant="caption" color="text.disabled" display="block">
						Retired {formatDate(decommissionedDate)}
						{decommissionReason ? ` · ${decommissionReason}` : ""}
					</Typography>
				)}
			</Box>
		</Box>
	);
}
