import { formatAssetType, formatDate } from "@/lib/format";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { AssetWear } from "@ogdb/types";

function Figure({
	value,
	label,
	hint,
}: {
	value: string;
	label: string;
	hint: string;
}) {
	return (
		<Box>
			<Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
				{value}
			</Typography>
			<Typography variant="subtitle2">{label}</Typography>
			<Typography variant="caption" color="text.secondary">
				{hint}
			</Typography>
		</Box>
	);
}

// The two wear counters for one asset (asset page, and a Seaglider's page).
export default function WearPanel({ wear }: { wear: AssetWear }) {
	return (
		<Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
			<Box sx={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
				<Figure
					value={wear.daysInWaterSinceServicing.toLocaleString("en-GB")}
					label="Days in water"
					hint={wear.neverServiced ? "lifetime total" : "since last servicing"}
				/>
				<Figure
					value={
						wear.daysSinceServicing != null
							? wear.daysSinceServicing.toLocaleString("en-GB")
							: "—"
					}
					label="Days since servicing"
					hint={
						wear.neverServiced
							? "no servicing on record"
							: "calendar days since last servicing"
					}
				/>
			</Box>
			<Typography
				variant="caption"
				color="text.secondary"
				sx={{ display: "block", mt: 2 }}
			>
				{wear.neverServiced
					? "Never serviced — no factory repair or calibration on record."
					: `Last servicing: ${formatDate(wear.lastServicingDate)} (${formatAssetType(wear.lastServicingEventType ?? "servicing")}). A factory repair or calibration restarts both counters.`}
			</Typography>
		</Paper>
	);
}
