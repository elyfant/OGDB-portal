import { stageLabel } from "@/lib/processing-stages";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";

// The mission's best internal L1/L2 NetCDF files (OGDB's mission_best_files
// view: highest QC level among completed processing runs, then the latest).
// Paths are relative to the shared GFI projects folder -- prefix your own
// mount (e.g. /Data/gfi/projects/) to open them.
function FileRow({
	level,
	file,
	stage,
}: {
	level: string;
	file: string | null;
	stage: string | null;
}) {
	return (
		<Box>
			<Typography variant="caption" color="text.secondary" display="block">
				{level}
			</Typography>
			{file ? (
				<Box
					sx={{
						display: "flex",
						alignItems: "center",
						gap: 1,
						flexWrap: "wrap",
					}}
				>
					<Chip size="small" label={stageLabel(stage)} />
					<Typography
						component="span"
						sx={{
							fontFamily: "monospace",
							fontSize: 13,
							wordBreak: "break-all",
						}}
					>
						{file}
					</Typography>
				</Box>
			) : (
				<Typography color="text.disabled">No file recorded</Typography>
			)}
		</Box>
	);
}

export default function BestDataFiles({
	l1File,
	l1Stage,
	l2File,
	l2Stage,
}: {
	l1File: string | null;
	l1Stage: string | null;
	l2File: string | null;
	l2Stage: string | null;
}) {
	return (
		<Box sx={{ display: "grid", gap: 2 }}>
			<FileRow level="L1 (timeseries)" file={l1File} stage={l1Stage} />
			<FileRow level="L2 (profiles)" file={l2File} stage={l2Stage} />
			<Typography variant="caption" color="text.secondary">
				Best available processing level. Paths are inside the shared projects
				folder (/Data/gfi/projects/ on the Bergen machines).
			</Typography>
		</Box>
	);
}
