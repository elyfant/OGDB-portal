"use client";

import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

// The end-of-row "edit" control for tables: a spanner. Editing happens ONLY
// through this button, never by clicking the row, so a highlighted /
// pointer-cursor row can mean one thing everywhere -- "this row opens another
// page" -- and nobody has to guess whether a click edits or navigates.
export default function EditRowButton({
	onClick,
	label = "Edit event",
}: {
	onClick: () => void;
	label?: string;
}) {
	return (
		<Tooltip title={label}>
			<IconButton
				size="small"
				aria-label={label}
				onClick={(e) => {
					e.stopPropagation();
					onClick();
				}}
			>
				<BuildOutlinedIcon fontSize="small" />
			</IconButton>
		</Tooltip>
	);
}
