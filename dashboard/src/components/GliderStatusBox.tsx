import { formatDate } from "@/lib/format";
import { hasLocation, locationText } from "@/lib/glider-location";
import { STATUS_LABEL, statusChipProps } from "@/lib/status-meta";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import type { AssetStatus, Glider } from "@ogdb/types";
import Link from "next/link";

function daysSince(date: string): number {
	const ms = Date.now() - new Date(date).getTime();
	return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

const SOURCE_LABEL: Record<string, string> = {
	// Covers Deployed, Workshop and Ready to deploy -- all driven by a mission.
	mission: "from a mission",
	service_event: "from a logged event",
	default: "no open mission, build or event",
};

// "Idle" is the derived-status fallback whenever there's no open mission,
// no open build and no open qualifying service event -- the "nothing
// open" wording is accurate for a glider that's just sitting unused. It
// stops being accurate once the asset is decommissioned *with a reason on
// record* (decommissionedDate/-Reason): something real IS logged, it's
// just not one of the events this derivation looks at (missions/service
// events, not decommission). Saying "nothing open" one line above
// "Decommissioned ... <reason>" reads as a flat contradiction, so this
// bucket gets its own wording instead.
const DECOMMISSIONED_DEFAULT_LABEL = "no activity logged since decommission";

function sourceLabel(source: string | null, isDecommissioned: boolean): string {
	if (source === "default" && isDecommissioned)
		return DECOMMISSIONED_DEFAULT_LABEL;
	return SOURCE_LABEL[source ?? "default"];
}

// A glider's state is derived from its timeline; location is a separate,
// optional recorded fact; Scheduled is a flag about the mission plan; and
// fleet lifecycle (decommissioned or not) is a fourth axis. See
// docs/design/glider-state-and-location.md.
export default function GliderStatusBox({
	status,
	statusSince,
	statusSource,
	decommissionedDate,
	decommissionReason,
	location,
	locationSince,
	locationSource,
	scheduledMissionId,
	scheduledDate,
}: {
	status: AssetStatus | null;
	statusSince: string | null;
	statusSource: "mission" | "service_event" | "default" | null;
	decommissionedDate: string | null;
	decommissionReason: string | null;
} & Pick<
	Glider,
	| "location"
	| "locationSince"
	| "locationSource"
	| "scheduledMissionId"
	| "scheduledDate"
>) {
	if (!status) {
		return <Typography color="text.disabled">Status not set.</Typography>;
	}

	const locationFields = { location, locationSince, locationSource };

	return (
		<Box
			sx={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}
		>
			<Chip
				label={STATUS_LABEL[status]}
				{...statusChipProps(status)}
				sx={{ fontSize: "1rem", py: 2.5, px: 1 }}
			/>
			{scheduledMissionId != null && (
				<Chip
					label="Scheduled"
					color="info"
					variant="outlined"
					component={Link}
					href={`/missions/${scheduledMissionId}`}
					clickable
					sx={{ py: 2.5, px: 1 }}
				/>
			)}
			{decommissionedDate && (
				<Chip
					label="Decommissioned"
					variant="outlined"
					sx={{ py: 2.5, px: 1 }}
				/>
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
				<Typography
					variant="body2"
					color={
						hasLocation(locationFields) ? "text.secondary" : "text.disabled"
					}
					sx={{ mt: 0.5 }}
				>
					Location: {locationText(locationFields)}
				</Typography>
				{scheduledMissionId != null && (
					<Typography variant="caption" color="text.disabled" display="block">
						Mission assigned
						{scheduledDate ? ` · planned ${formatDate(scheduledDate)}` : ""}
					</Typography>
				)}
				{decommissionedDate && (
					<Typography variant="caption" color="text.disabled" display="block">
						Decommissioned {formatDate(decommissionedDate)}
						{decommissionReason ? ` · ${decommissionReason}` : ""}
					</Typography>
				)}
			</Box>
		</Box>
	);
}
