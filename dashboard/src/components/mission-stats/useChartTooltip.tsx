"use client";

import Box from "@mui/material/Box";
import { type MouseEvent, type ReactNode, useState } from "react";

interface TooltipState {
	visible: boolean;
	x: number;
	y: number;
	content: ReactNode;
}

// Shared hover-tooltip behavior for the hand-drawn SVG charts on this
// page: a small fixed-position label that follows the cursor. Each chart
// calls this once and renders the returned node alongside its <svg>.
export function useChartTooltip() {
	const [tooltip, setTooltip] = useState<TooltipState>({
		visible: false,
		x: 0,
		y: 0,
		content: null,
	});

	function show(evt: MouseEvent, content: ReactNode) {
		setTooltip({ visible: true, x: evt.clientX, y: evt.clientY, content });
	}
	function hide() {
		setTooltip((t) => ({ ...t, visible: false }));
	}

	const node = tooltip.visible ? (
		<Box
			sx={{
				position: "fixed",
				left: tooltip.x + 14,
				top: tooltip.y + 14,
				zIndex: 1300,
				pointerEvents: "none",
				bgcolor: "text.primary",
				color: "background.paper",
				fontSize: 12,
				lineHeight: 1.5,
				px: 1.25,
				py: 0.75,
				borderRadius: 1.5,
				boxShadow: 3,
				maxWidth: 240,
			}}
		>
			{tooltip.content}
		</Box>
	) : null;

	return { show, hide, node };
}
