import {
	LIFECYCLE_LABEL,
	endingCauseChip,
	lifecycleChipProps,
	lifecycleTitle,
	missionLifecycle,
} from "@/lib/mission-lifecycle";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import type { Mission } from "@ogdb/types";

// A mission's two tags, the same everywhere (missions table, mission page, home
// page): the LIFECYCLE chip (Workshop / Scheduled / Active / Ended), and, once it
// has ended, the CAUSE OF ENDING chip. Each says what it is on hover.
export default function MissionLifecycleChips({
	mission,
	size = "small",
	show = "both",
}: {
	mission: Pick<Mission, "status" | "endingCause">;
	size?: "small" | "medium";
	// "both" on the mission page and home page; the table gives each its own
	// column, so it asks for one at a time.
	show?: "both" | "lifecycle" | "cause";
}) {
	const lifecycle = missionLifecycle(mission.status);
	const cause = show === "lifecycle" ? null : endingCauseChip(mission);
	if (show !== "cause" && !lifecycle && !mission.status) return null;

	return (
		<>
			{show !== "cause" &&
				(lifecycle ? (
					<Tooltip title={lifecycleTitle(lifecycle)}>
						<Chip
							size={size}
							label={LIFECYCLE_LABEL[lifecycle]}
							{...lifecycleChipProps(lifecycle)}
						/>
					</Tooltip>
				) : (
					// A status this view doesn't know: show it as it is stored.
					<Chip size={size} label={mission.status} variant="outlined" />
				))}
			{cause && (
				<Tooltip title={cause.title}>
					<Chip size={size} label={cause.label} {...cause.look} />
				</Tooltip>
			)}
		</>
	);
}
