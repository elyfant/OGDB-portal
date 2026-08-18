import CalibrationHistory from "@/components/CalibrationHistory";
import { formatAssetType } from "@/lib/format";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import type { GliderSciencePayloadItem } from "@ogdb/types";

export default function GliderSciencePayload({
	sciencePayload,
}: {
	sciencePayload: GliderSciencePayloadItem[];
}) {
	if (sciencePayload.length === 0) {
		return (
			<Typography color="text.disabled">
				No science sensors currently assigned.
			</Typography>
		);
	}

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
			{sciencePayload.map((sensor) => (
				<Paper key={sensor.assetId} variant="outlined" sx={{ p: 2 }}>
					<Typography variant="subtitle1">
						{formatAssetType(sensor.assetType)} — {sensor.serialNumber ?? "—"}
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
						{sensor.modelLabel ?? "Model not set"}
						{sensor.familyLabel ? ` · ${sensor.familyLabel}` : ""}
					</Typography>
					<CalibrationHistory calibrations={sensor.calibrations} />
				</Paper>
			))}
		</Box>
	);
}
