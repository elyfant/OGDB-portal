import GliderCurrentBuild from "@/components/GliderCurrentBuild";
import GliderDiagram from "@/components/GliderDiagram";
import ScienceBuildTable from "@/components/ScienceBuildTable";
import { formatDate } from "@/lib/format";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Typography from "@mui/material/Typography";
import type {
	GliderBuildComponent,
	GliderComponentDetail,
	ScienceSensorRecord,
	SensorCalRecord,
} from "@ogdb/types";

// The contents of the build box, shared by the glider page's Current build
// and the mission page's Glider build so the two read the same: the glider
// diagram, a faint rule, then Sections / Hulls / Power / (Tracking) and the
// Science table. Only what the data is "as of" differs.
export default function BuildPanel({
	mode,
	components,
	sensors,
	asOfDate,
	showDiagram,
	componentDetails,
	calibrationHistory,
	emptyMessage,
	calibrationNote,
}: {
	// "current": the last flown build, with each sensor's current
	// calibration. "mission": one mission's build, with the calibration in
	// effect at its launch.
	mode: "current" | "mission";
	components: GliderBuildComponent[];
	sensors: ScienceSensorRecord[];
	// The date calibrations are as of: launch date for a mission, otherwise
	// today.
	asOfDate: string;
	// The diagram only exists for Slocum gliders so far.
	showDiagram: boolean;
	// Row-expansion detail for the non-science components (only loaded for
	// the live build).
	componentDetails?: GliderComponentDetail[];
	calibrationHistory?: Record<number, SensorCalRecord[]>;
	// Shown instead of the table when the build has nothing in it.
	emptyMessage?: string;
	// Overrides the mission-mode caption under "Science" (e.g. a mission that
	// has not launched has no launch date to be "as of").
	calibrationNote?: string;
}) {
	const nonScience = components.filter((c) => c.assetTypeGroup !== "sensor");

	if (nonScience.length === 0 && sensors.length === 0) {
		return (
			<Typography color="text.disabled">
				{emptyMessage ??
					(mode === "mission"
						? "No build recorded for this mission yet."
						: "No build recorded yet.")}
			</Typography>
		);
	}

	// The diagram is drawn from build components, and the science sensors
	// come back in their own shape, so fold them into the same one.
	const sensorComponents: GliderBuildComponent[] = sensors.map((s) => ({
		itemId: 0,
		assetId: s.assetId,
		parentAssetId: 0,
		assetType: s.assetType,
		assetTypeGroup: "sensor",
		serialNumber: s.serialNumber,
		position: null,
		depth: 1,
		model: s.model,
		modelUri: s.modelUri,
	}));

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
			{showDiagram && (
				<>
					<GliderDiagram components={[...nonScience, ...sensorComponents]} />
					<Divider sx={{ opacity: 0.6 }} />
				</>
			)}

			<GliderCurrentBuild
				components={nonScience}
				componentDetails={componentDetails}
			/>

			<Box>
				<Typography
					variant="overline"
					sx={{ color: "text.secondary", letterSpacing: 1 }}
				>
					Science
				</Typography>
				{mode === "mission" && (
					<Typography
						variant="caption"
						color="text.secondary"
						sx={{ mb: 1, display: "block" }}
					>
						{calibrationNote ??
							`Calibration shown as of this mission's launch date, ${formatDate(asOfDate)}`}
					</Typography>
				)}
				<ScienceBuildTable
					sensors={sensors}
					mode={mode}
					asOfDate={asOfDate}
					calibrationHistory={calibrationHistory}
				/>
			</Box>
		</Box>
	);
}
