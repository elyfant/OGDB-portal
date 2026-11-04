import GliderDiagram from "@/components/GliderDiagram";
import SciencePayloadTable from "@/components/SciencePayloadTable";
import { formatAssetType, formatDate } from "@/lib/format";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { GliderBuildComponent, ScienceSensorRecord } from "@ogdb/types";
import Link from "next/link";

// Fixed display order, same as the glider page's Current build. Science
// sensors aren't in this list: they come from the mission's science payload
// (with calibration as of launch) and get their own section below.
const GROUPS: { group: string; label: string }[] = [
	{ group: "structural", label: "Sections" },
	{ group: "hull", label: "Hulls" },
	{ group: "power", label: "Power" },
	{ group: "tracking", label: "Tracking" },
];

// Same split as GliderCurrentBuild: hulls are stored with the other
// structural parts, so they're pulled out by asset type; "structural" is
// then just the sections.
function displayGroup(c: GliderBuildComponent): string {
	return c.assetType === "slocum_hull" ? "hull" : c.assetTypeGroup;
}

// Same fixed column layout as GliderCurrentBuild, so every group's table
// lines up -- each group renders its own <Table> under its heading.
const COLUMN_WIDTHS = ["34%", "34%", "17%", "15%"];

function SectionHeading({ children }: { children: string }) {
	return (
		<Typography
			variant="overline"
			sx={{ color: "text.secondary", letterSpacing: 1 }}
		>
			{children}
		</Typography>
	);
}

// The mission-page counterpart of the glider page's Current build box: the
// glider diagram, then the build split into Structural / Power / Science --
// but as it was for this mission (as of its launch date), not as it is today.
export default function MissionBuild({
	structuralComponents,
	sciencePayload,
	launchDate,
	showDiagram,
}: {
	// Every non-sensor component, as of the mission's launch date.
	structuralComponents: GliderBuildComponent[];
	sciencePayload: ScienceSensorRecord[];
	launchDate: string | null;
	// The diagram only exists for Slocum gliders so far.
	showDiagram: boolean;
}) {
	// The diagram is drawn from build components, and science sensors come
	// back in their own shape, so fold them into the same one.
	const sensorComponents: GliderBuildComponent[] = sciencePayload.map((s) => ({
		assignmentId: null,
		assetId: s.assetId,
		parentAssetId: 0,
		assetType: s.assetType,
		assetTypeGroup: "sensor",
		serialNumber: s.serialNumber,
		position: null,
		installDate: null,
		depth: 1,
		model: s.model,
		modelUri: s.modelUri,
	}));
	const diagramComponents = [...structuralComponents, ...sensorComponents];

	const groups = GROUPS.map((g) => ({
		...g,
		items: structuralComponents.filter((c) => displayGroup(c) === g.group),
	})).filter((g) => g.items.length > 0);

	if (diagramComponents.length === 0) {
		return (
			<Typography color="text.disabled">
				No build recorded for this mission yet.
			</Typography>
		);
	}

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
			{showDiagram && <GliderDiagram components={diagramComponents} />}

			{groups.map(({ group, label, items }) => (
				<Box key={group}>
					<SectionHeading>{label}</SectionHeading>
					<Table size="small" sx={{ tableLayout: "fixed" }}>
						<TableHead>
							<TableRow>
								<TableCell sx={{ width: COLUMN_WIDTHS[0] }}>Asset</TableCell>
								<TableCell sx={{ width: COLUMN_WIDTHS[1] }}>Model</TableCell>
								<TableCell sx={{ width: COLUMN_WIDTHS[2] }}>
									Serial number
								</TableCell>
								<TableCell sx={{ width: COLUMN_WIDTHS[3] }}>
									Install date
								</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{items.map((c) => (
								<TableRow key={c.assetId}>
									<TableCell sx={{ pl: 2 + (c.depth - 1) * 2 }}>
										{formatAssetType(c.assetType)}
										{c.position ? ` (${c.position})` : ""}
									</TableCell>
									<TableCell>{c.model ?? "—"}</TableCell>
									<TableCell>
										{c.serialNumber ? (
											<Tooltip title="Open asset details">
												<MuiLink component={Link} href={`/assets/${c.assetId}`}>
													{c.serialNumber}
												</MuiLink>
											</Tooltip>
										) : (
											"—"
										)}
									</TableCell>
									<TableCell>{formatDate(c.installDate)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</Box>
			))}

			<Box>
				<SectionHeading>Science</SectionHeading>
				<Typography
					variant="caption"
					color="text.secondary"
					sx={{ mb: 1, display: "block" }}
				>
					{launchDate
						? `Calibration shown as of this mission's launch date, ${formatDate(launchDate)}`
						: "Calibration shown as of today — no launch date recorded for this mission yet"}
				</Typography>
				<SciencePayloadTable
					bare
					sensors={sciencePayload}
					asOfDate={launchDate ?? new Date().toISOString()}
				/>
			</Box>
		</Box>
	);
}
