import CalibrationHistory from "@/components/CalibrationHistory";
import PasteCalibrationDialog from "@/components/PasteCalibrationDialog";
import {
	formatAssetType,
	formatFieldName,
	formatFieldValue,
} from "@/lib/format";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { GliderComponentDetail } from "@ogdb/types";

export default function GliderComponentDetailPanel({
	assetType,
	detail,
}: {
	assetType: string;
	detail: GliderComponentDetail;
}) {
	const typeLabel = formatAssetType(assetType);
	const fields = detail.detail ? Object.entries(detail.detail) : [];

	return (
		<Box sx={{ py: 1, display: "flex", flexDirection: "column", gap: 2 }}>
			{detail.detail && (
				<Box>
					<Typography variant="subtitle2" sx={{ mb: 1 }}>
						{typeLabel} details
					</Typography>
					{fields.length === 0 ? (
						<Typography color="text.disabled" variant="body2">
							No detail fields recorded.
						</Typography>
					) : (
						<Table size="small">
							<TableBody>
								{fields.map(([field, value]) => (
									<TableRow key={field}>
										<TableCell sx={{ color: "text.secondary", width: "40%" }}>
											{formatFieldName(field)}
										</TableCell>
										<TableCell>{formatFieldValue(value)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</Box>
			)}

			{detail.calibrations !== null && (
				<Box>
					<Box
						sx={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							mb: 1,
						}}
					>
						<Typography variant="subtitle2">
							{typeLabel} calibration information
						</Typography>
						<PasteCalibrationDialog
							assetId={detail.assetId}
							assetType={assetType}
						/>
					</Box>
					<CalibrationHistory calibrations={detail.calibrations} />
				</Box>
			)}
		</Box>
	);
}
