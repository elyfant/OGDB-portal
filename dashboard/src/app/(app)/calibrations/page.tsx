import CalibrationFormDialog from "@/components/CalibrationFormDialog";
import CalibrationsCatalogue from "@/components/CalibrationsCatalogue";
import { getCalibrationCatalogue } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export default async function CalibrationsPage() {
	const [data, user] = await Promise.all([
		getCalibrationCatalogue(),
		getCurrentUser(),
	]);
	const canEdit = user?.role === "editor" || user?.role === "admin";

	return (
		<Box>
			<Box
				sx={{
					display: "flex",
					alignItems: "flex-start",
					justifyContent: "space-between",
					flexWrap: "wrap",
					gap: 2,
					mb: 3,
				}}
			>
				<Box>
					<Typography variant="h5" sx={{ mb: 0.5 }}>
						Calibrations
					</Typography>
					<Typography variant="body2" color="text.secondary">
						Every science sensor's calibration history, grouped by type and
						model.
					</Typography>
				</Box>
				{canEdit && <CalibrationFormDialog mode="create" />}
			</Box>
			<CalibrationsCatalogue data={data} canEdit={canEdit} />
		</Box>
	);
}
