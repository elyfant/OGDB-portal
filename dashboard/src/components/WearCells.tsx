import { formatDate } from "@/lib/format";
import { formatAssetType } from "@/lib/format";
import MuiTableCell from "@mui/material/TableCell";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { AssetWear } from "@ogdb/types";

// Wear counters (see the asset_wear_counters view): days in the water and
// calendar days since the asset's last factory repair or calibration. An
// asset that is not a tracked type has no row, and shows "—".

export function wearTooltip(wear: AssetWear): string {
	if (wear.neverServiced) {
		return "No factory repair or calibration on record — days in water is the lifetime total.";
	}
	return `Last servicing: ${formatDate(wear.lastServicingDate)} (${formatAssetType(wear.lastServicingEventType ?? "servicing")})`;
}

export function WearHeadCells({ widths }: { widths: [string, string] }) {
	return (
		<>
			<Tooltip title="Mission-days in the water since the last factory repair or calibration">
				<MuiTableCell sx={{ width: widths[0] }}>Days in water</MuiTableCell>
			</Tooltip>
			<Tooltip title="Calendar days since the last factory repair or calibration">
				<MuiTableCell sx={{ width: widths[1] }}>
					Days since service
				</MuiTableCell>
			</Tooltip>
		</>
	);
}

export function WearCells({ wear }: { wear: AssetWear | undefined }) {
	if (!wear) {
		return (
			<>
				<MuiTableCell>—</MuiTableCell>
				<MuiTableCell>—</MuiTableCell>
			</>
		);
	}
	return (
		<>
			<Tooltip title={wearTooltip(wear)}>
				<MuiTableCell>{wear.daysInWaterSinceServicing}</MuiTableCell>
			</Tooltip>
			<Tooltip title={wearTooltip(wear)}>
				<MuiTableCell>
					{wear.daysSinceServicing ?? (
						<Typography component="span" variant="body2" color="text.secondary">
							Never serviced
						</Typography>
					)}
				</MuiTableCell>
			</Tooltip>
		</>
	);
}
