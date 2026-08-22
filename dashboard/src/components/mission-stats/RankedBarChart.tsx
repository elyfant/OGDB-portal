"use client";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";
import { useChartTooltip } from "./useChartTooltip";

export interface RankedBarRow {
	key: string;
	label: string;
	value: number;
	color?: string;
}

const CHART_WIDTH = 560;
const ROW_HEIGHT = 32;
const TOP = 6;
const LEFT = 96;
const RIGHT = 48;
// Matches the deployment timeline's bar opacity, so the two charts read
// as the same visual system.
const BAR_FILL_OPACITY = 0.55;

// One horizontal bar per row, sorted and colored by the caller. Reused
// for both "days by project" and "fleet utilization" rather than
// building two near-identical charts.
export default function RankedBarChart({
	rows,
	valueSuffix = "",
	highlightedKey = null,
}: {
	rows: RankedBarRow[];
	valueSuffix?: string;
	highlightedKey?: string | null;
}) {
	const theme = useTheme();
	const { show, hide, node } = useChartTooltip();

	if (rows.length === 0) {
		return (
			<Box
				sx={{
					color: "text.secondary",
					fontSize: 14,
					py: 4,
					textAlign: "center",
				}}
			>
				No data yet.
			</Box>
		);
	}

	const maxV = Math.max(1, ...rows.map((r) => r.value)) * 1.08;
	const plotW = CHART_WIDTH - LEFT - RIGHT;
	const height = TOP + rows.length * ROW_HEIGHT;

	return (
		<Box sx={{ overflowX: "auto" }}>
			<Box
				component="svg"
				viewBox={`0 0 ${CHART_WIDTH} ${height}`}
				sx={{ width: "100%", minWidth: 380, display: "block" }}
			>
				{rows.map((r, i) => {
					const y = TOP + i * ROW_HEIGHT;
					const barH = 16;
					const w = (r.value / maxV) * plotW;
					const fill = r.color ?? theme.palette.primary.main;
					const dimmed = highlightedKey !== null && r.key !== highlightedKey;
					return (
						<g
							key={r.key}
							opacity={dimmed ? 0.3 : 1}
							style={{ transition: "opacity 0.12s ease" }}
						>
							<text
								x={LEFT - 10}
								y={y + barH / 2 + 3.5}
								fontSize={11.5}
								fontWeight={600}
								textAnchor="end"
								fill={theme.palette.text.primary}
							>
								{r.label}
							</text>
							<rect
								x={LEFT}
								y={y}
								width={Math.max(w, 3)}
								height={barH}
								rx={3}
								fill={fill}
								fillOpacity={BAR_FILL_OPACITY}
								style={{ cursor: "default" }}
								onMouseMove={(evt) =>
									show(
										evt,
										<>
											<Box
												component="span"
												sx={{ display: "block", fontWeight: 700, mb: 0.25 }}
											>
												{r.label}
											</Box>
											{r.value}
											{valueSuffix}
										</>,
									)
								}
								onMouseLeave={hide}
							/>
							<text
								x={LEFT + w + 8}
								y={y + barH / 2 + 3.5}
								fontSize={11}
								fontWeight={600}
								fill={theme.palette.text.secondary}
							>
								{r.value}
								{valueSuffix}
							</text>
						</g>
					);
				})}
			</Box>
			{node}
		</Box>
	);
}
