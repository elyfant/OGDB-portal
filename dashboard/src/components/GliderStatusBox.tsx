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
						SOURCE_LABEL[statusSource ?? "default"]
					)}
				</Typography>
				{statusSince && statusSource && SOURCE_LABEL[statusSource] && (
					<Typography variant="caption" color="text.disabled">
						{SOURCE_LABEL[statusSource]}
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
