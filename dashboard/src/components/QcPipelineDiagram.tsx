"use client";

import Box from "@mui/material/Box";
import { useTheme } from "@mui/material/styles";

// Two-lane comparison of the Seaglider and Slocum QC pipelines, redrawn
// from the team's whiteboard sketch (see the "NorGliders QC processing
// pipeline" info page). Structure only -- SG runs manual QC twice (phase
// 1 feeding delayed mode processing, phase 2 feeding the final/published
// pass); SL runs a single manual QC covering both phases at the final
// pass. Colours come from the MUI theme (not the artifact's own palette)
// so this matches the rest of the dashboard in both light and dark mode.
function Lane({
	y,
	tag,
	subtitle,
	dmSub,
	manualQcCount,
}: {
	y: number;
	tag: string;
	subtitle: string;
	dmSub: string;
	manualQcCount: 1 | 2;
}) {
	const theme = useTheme();
	const ink = theme.palette.text.primary;
	const muted = theme.palette.text.secondary;
	const box = theme.palette.background.paper;
	const accent = theme.palette.primary.main;
	const accentWash =
		theme.palette.mode === "dark"
			? theme.palette.primary.dark
			: theme.palette.primary.light;

	return (
		<g transform={`translate(0,${y})`}>
			<text x={30} y={40} fontSize={22} fontWeight={700} fill={ink}>
				{tag}
			</text>
			<text x={30} y={58} fontSize={11.5} fill={muted}>
				{subtitle}
			</text>

			<rect
				x={90}
				y={20}
				width={130}
				height={60}
				rx={3}
				fill={box}
				stroke={ink}
				strokeWidth={1.5}
			/>
			<text x={155} y={44} textAnchor="middle" fontSize={15} fontWeight={600} fill={ink}>
				Raw
			</text>
			<text x={155} y={62} textAnchor="middle" fontSize={10.5} fill={muted}>
				RT
			</text>

			<line
				x1={220}
				y1={50}
				x2={322}
				y2={50}
				stroke={ink}
				strokeWidth={1.75}
				markerEnd="url(#qc-arrow-ink)"
			/>

			<rect
				x={330}
				y={10}
				width={170}
				height={80}
				rx={3}
				fill={box}
				stroke={ink}
				strokeWidth={1.5}
			/>
			<text x={415} y={38} textAnchor="middle" fontSize={15} fontWeight={600} fill={ink}>
				Delayed mode
			</text>
			<text x={415} y={54} textAnchor="middle" fontSize={15} fontWeight={600} fill={ink}>
				processing
			</text>
			<line x1={345} y1={66} x2={485} y2={66} stroke={theme.palette.divider} strokeWidth={1} />
			<text x={415} y={82} textAnchor="middle" fontSize={10.5} fill={muted}>
				{dmSub}
			</text>

			<text x={570} y={30} textAnchor="middle" fontSize={10.5} fill={theme.palette.text.secondary}>
				delayed mode
			</text>
			<text x={570} y={42} textAnchor="middle" fontSize={10.5} fill={theme.palette.text.secondary}>
				data product
			</text>
			<line
				x1={500}
				y1={50}
				x2={638}
				y2={50}
				stroke={ink}
				strokeWidth={1.75}
				markerEnd="url(#qc-arrow-ink)"
			/>
			<text x={570} y={68} textAnchor="middle" fontSize={10} fontFamily="monospace" fill={muted}>
				L1, L2
			</text>

			<rect
				x={640}
				y={10}
				width={170}
				height={80}
				rx={3}
				fill={box}
				stroke={ink}
				strokeWidth={1.5}
			/>
			<text x={725} y={48} textAnchor="middle" fontSize={15} fontWeight={600} fill={ink}>
				Final QC
			</text>
			<line x1={655} y1={62} x2={795} y2={62} stroke={theme.palette.divider} strokeWidth={1} />
			<text x={725} y={78} textAnchor="middle" fontSize={10.5} fill={muted}>
				manual QC
			</text>

			<text x={855} y={28} textAnchor="middle" fontSize={10} fill={muted}>
				final QC
			</text>
			<text x={855} y={39} textAnchor="middle" fontSize={10} fill={muted}>
				data product
			</text>
			<line
				x1={810}
				y1={50}
				x2={898}
				y2={50}
				stroke={ink}
				strokeWidth={1.75}
				markerEnd="url(#qc-arrow-ink)"
			/>
			<text x={855} y={68} textAnchor="middle" fontSize={10} fontFamily="monospace" fill={muted}>
				L1, L2
			</text>
			<text x={908} y={55} fontSize={14} fontWeight={700} fill={ink}>
				Published
			</text>

			{manualQcCount === 2 && (
				<>
					<rect
						x={70}
						y={185}
						width={240}
						height={100}
						rx={16}
						fill={accentWash}
						stroke={accent}
						strokeWidth={1.5}
						strokeDasharray="1,4"
					/>
					<text x={190} y={208} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={accent}>
						manual QC
					</text>
					<text x={190} y={224} textAnchor="middle" fontSize={10} fontWeight={600} fill={accent}>
						PHASE 1
					</text>
					<text x={190} y={244} textAnchor="middle" fontSize={11.5} fill={ink}>
						flags bad data
					</text>
					<text x={190} y={260} textAnchor="middle" fontSize={11.5} fill={ink}>
						compares to ship CTD
					</text>
					<line
						x1={300}
						y1={185}
						x2={300}
						y2={56}
						stroke={accent}
						strokeWidth={1.75}
						strokeDasharray="1,4"
						strokeLinecap="round"
						markerEnd="url(#qc-arrow-accent)"
					/>
				</>
			)}

			<rect
				x={650}
				y={200}
				width={150}
				height={70}
				rx={16}
				fill={accentWash}
				stroke={accent}
				strokeWidth={1.5}
				strokeDasharray="1,4"
			/>
			<text x={725} y={230} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={accent}>
				manual QC
			</text>
			<text x={725} y={250} textAnchor="middle" fontSize={11.5} fill={ink}>
				{manualQcCount === 2 ? "phase 2" : "phase 1 and 2"}
			</text>
			<line
				x1={725}
				y1={200}
				x2={725}
				y2={92}
				stroke={accent}
				strokeWidth={1.75}
				strokeDasharray="1,4"
				strokeLinecap="round"
				markerEnd="url(#qc-arrow-accent)"
			/>
		</g>
	);
}

export default function QcPipelineDiagram() {
	const theme = useTheme();
	const ink = theme.palette.text.primary;
	const muted = theme.palette.text.secondary;
	const accent = theme.palette.primary.main;

	return (
		<Box
			sx={{
				border: "1px solid",
				borderColor: "divider",
				borderRadius: 1,
				bgcolor: "background.paper",
				p: 1,
				overflowX: "auto",
			}}
		>
			<svg
				viewBox="0 0 1120 700"
				role="img"
				aria-label="Two data pipelines. Seaglider: raw real-time data flows into delayed mode processing, where a manual QC check also feeds in as phase 1 to flag bad data and compare against shipboard CTD; the output passes to a final QC step, which receives a second manual QC check, phase 2, before publication. Slocum: raw real-time data flows into delayed mode processing, then to a final QC step, which receives a single manual QC check covering phase 1 and phase 2, before publication."
				style={{ display: "block", width: "100%", height: "auto", minWidth: 720 }}
			>
				<defs>
					<marker
						id="qc-arrow-ink"
						viewBox="0 0 10 10"
						refX={8}
						refY={5}
						markerWidth={7}
						markerHeight={7}
						orient="auto-start-reverse"
					>
						<path d="M0,0 L10,5 L0,10 z" fill={ink} />
					</marker>
					<marker
						id="qc-arrow-accent"
						viewBox="0 0 10 10"
						refX={8}
						refY={5}
						markerWidth={7}
						markerHeight={7}
						orient="auto-start-reverse"
					>
						<path d="M0,0 L10,5 L0,10 z" fill={accent} />
					</marker>
				</defs>

				<g transform="translate(760,10)">
					<line x1={0} y1={6} x2={30} y2={6} stroke={ink} strokeWidth={2} markerEnd="url(#qc-arrow-ink)" />
					<text x={38} y={10} fontSize={11.5} fill={muted}>
						automated data flow
					</text>
					<line
						x1={0}
						y1={26}
						x2={30}
						y2={26}
						stroke={accent}
						strokeWidth={2}
						strokeDasharray="1,4"
						strokeLinecap="round"
						markerEnd="url(#qc-arrow-accent)"
					/>
					<text x={38} y={30} fontSize={11.5} fill={muted}>
						manual QC input
					</text>
				</g>

				<Lane
					y={40}
					tag="SG"
					subtitle="Seaglider"
					dmSub="auto & manual QC"
					manualQcCount={2}
				/>

				<line x1={20} y1={370} x2={1100} y2={370} stroke={theme.palette.divider} strokeWidth={1} />

				<Lane
					y={400}
					tag="SL"
					subtitle="Slocum"
					dmSub="auto QC"
					manualQcCount={1}
				/>
			</svg>
		</Box>
	);
}
