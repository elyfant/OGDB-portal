"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Tooltip from "@mui/material/Tooltip";
import type { ReactNode } from "react";

export const NVS_TOOLTIP = "View NERC Vocabulary Server definition";

// The info-circle icon that links a displayed value out to the NVS term
// it came from. Use this everywhere an NVS URI is shown so they all look
// and behave the same: muted at rest, highlighted on hover, with the same
// tooltip. Renders nothing without a URI -- never a dead icon.
//
// Opens in a new tab and stops the click propagating, so it's safe inside
// a clickable row (e.g. the science payload table's expandable rows).
export default function NvsLink({
	uri,
	iconSize = 16,
}: {
	uri: string | null | undefined;
	iconSize?: number;
}) {
	if (!uri) return null;
	return (
		<Tooltip title={NVS_TOOLTIP}>
			<MuiLink
				href={uri}
				target="_blank"
				rel="noreferrer"
				aria-label={NVS_TOOLTIP}
				onClick={(e) => e.stopPropagation()}
				sx={{
					display: "inline-flex",
					borderRadius: "50%",
					color: "text.secondary",
					transition: "color 120ms, background-color 120ms",
					"&:hover, &:focus-visible": {
						color: "primary.main",
						backgroundColor: "action.hover",
					},
				}}
			>
				<InfoOutlinedIcon sx={{ fontSize: iconSize }} />
			</MuiLink>
		</Tooltip>
	);
}

// A value with its NvsLink alongside, for Field values.
export function NvsValue({
	text,
	uri,
}: {
	text: ReactNode;
	uri: string | null | undefined;
}) {
	return (
		<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
			{text}
			<NvsLink uri={uri} />
		</Box>
	);
}
