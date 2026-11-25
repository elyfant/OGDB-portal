import Field from "@/components/Field";
import StartRefurbishmentButton from "@/components/StartRefurbishmentButton";
import { formatDate, formatDateTime } from "@/lib/format";
import LockIcon from "@mui/icons-material/Lock";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { Refurbishment } from "@ogdb/types";

// Header of the Seaglider pre-mission refurbishment logsheet, shown on the
// glider's workshop mission. Glider identity is read from the glider, never
// typed. The logsheet sections themselves live on the mission page's
// "Refurb logsheet" tab; this is only the summary.
export default function RefurbishmentSection({
	missionId,
	refurbishment,
	canEdit,
}: {
	missionId: number;
	refurbishment: Refurbishment | null;
	canEdit: boolean;
}) {
	if (!refurbishment) {
		return (
			<Paper variant="outlined" sx={{ p: 3 }}>
				<Typography color="text.secondary" sx={{ mb: 2 }}>
					No refurbishment logsheet has been started for this mission.
				</Typography>
				{canEdit && <StartRefurbishmentButton missionId={missionId} />}
			</Paper>
		);
	}

	const cleared = refurbishment.clearedAt !== null;

	return (
		<Paper variant="outlined" sx={{ p: 3 }}>
			<Box
				sx={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
					gap: 2,
					mb: 2,
				}}
			>
				<Field label="Glider SN" value={refurbishment.serialNumber} />
				<Field label="Glider" value={refurbishment.gliderName} />
				<Field
					label="Started"
					value={`${formatDate(refurbishment.startedAt)}${
						refurbishment.startedByName
							? ` by ${refurbishment.startedByName}`
							: ""
					}`}
				/>
			</Box>

			{cleared ? (
				<Alert severity="success" icon={<LockIcon fontSize="inherit" />}>
					Cleared for deployment
					{refurbishment.clearedByName
						? ` by ${refurbishment.clearedByName}`
						: ""}{" "}
					on {formatDateTime(refurbishment.clearedAt)}. The logsheet is locked.
				</Alert>
			) : (
				<Alert severity="info">
					{(() => {
						const required = refurbishment.sections.filter((s) => s.required);
						const open = required.filter((s) => !s.complete).length;
						return open === 0
							? "Every required section is done. Open the Refurb logsheet tab to clear the glider for deployment."
							: `Not cleared yet: ${open} of ${required.length} required sections still to do. Open the Refurb logsheet tab to see what is left in each.`;
					})()}
				</Alert>
			)}
		</Paper>
	);
}
