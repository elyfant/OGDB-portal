import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { MissionFile } from "@ogdb/types";

// Presentational only -- the "Add key mission file" button and its modal
// live in MissionFilesEditor. Files open in a new tab via the documents
// proxy, which serves ascii/text with a text/plain content type so the
// browser renders them inline rather than downloading.
export default function KeyFiles({ files }: { files: MissionFile[] }) {
	if (files.length === 0) {
		return (
			<Typography variant="body2" color="text.disabled">
				No key files yet.
			</Typography>
		);
	}

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
			{files.map((file) => (
				<Box
					key={file.id}
					sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
				>
					<InsertDriveFileOutlinedIcon
						fontSize="small"
						sx={{ color: "text.secondary", flexShrink: 0 }}
					/>
					{file.available ? (
						<MuiLink
							href={`/api/documents/${file.id}/file`}
							target="_blank"
							rel="noreferrer"
							sx={{
								display: "inline-flex",
								alignItems: "center",
								gap: 0.5,
								fontSize: 14,
								wordBreak: "break-all",
							}}
						>
							{file.name}
							<OpenInNewIcon sx={{ fontSize: 13, flexShrink: 0 }} />
						</MuiLink>
					) : (
						<Tooltip title="Stored on the old network share, not on this server — can't be opened here.">
							<Typography
								variant="body2"
								color="text.disabled"
								sx={{ wordBreak: "break-all" }}
							>
								{file.name}
							</Typography>
						</Tooltip>
					)}
				</Box>
			))}
		</Box>
	);
}
