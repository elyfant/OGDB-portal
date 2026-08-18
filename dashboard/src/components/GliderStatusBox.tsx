import { formatDate } from "@/lib/format";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status-meta";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import type { AssetStatus, GliderStatusHistoryItem } from "@ogdb/types";

function daysSince(date: string): number {
	const ms = Date.now() - new Date(date).getTime();
	return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export default function GliderStatusBox({
	status,
	statusEffectiveDate,
	statusHistory,
}: {
	status: AssetStatus | null;
	statusEffectiveDate: string | null;
	statusHistory: GliderStatusHistoryItem[];
}) {
	if (!status) {
		return <Typography color="text.disabled">Status not set.</Typography>;
	}

	// statusHistory covers the glider and everything assigned to it —
	// narrow to the glider's own entries for "what was it before this".
	const gliderHistory = statusHistory.filter((s) => s.assetType === "glider");
	const previous = gliderHistory[1];

	return (
		<Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
			<Chip
				label={STATUS_LABEL[status]}
				color={STATUS_COLOR[status]}
				sx={{ fontSize: "1rem", py: 2.5, px: 1 }}
			/>
			<Box>
				<Typography variant="body2" color="text.secondary">
					{statusEffectiveDate ? (
						<>
							Since {formatDate(statusEffectiveDate)} (
							{daysSince(statusEffectiveDate)}{" "}
							{daysSince(statusEffectiveDate) === 1 ? "day" : "days"})
						</>
					) : (
						"Effective date unknown"
					)}
				</Typography>
				{previous && (
					<Typography variant="caption" color="text.disabled">
						Previously {STATUS_LABEL[previous.status]} (
						{formatDate(previous.effectiveDate)})
					</Typography>
				)}
			</Box>
		</Box>
	);
}
