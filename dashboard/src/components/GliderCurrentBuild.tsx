import { formatAssetType, formatDate } from "@/lib/format";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { GliderBuildComponent } from "@ogdb/types";

// Fixed display order — Fiona's spec. Any group not present (e.g. no
// tracking assets on this glider) is skipped rather than shown empty.
const GROUP_ORDER = ["structural", "power", "sensor", "tracking"];
const GROUP_LABEL: Record<string, string> = {
	structural: "Structural",
	power: "Power",
	sensor: "Science sensors",
	tracking: "Tracking",
};

export default function GliderCurrentBuild({
	components,
}: {
	components: GliderBuildComponent[];
}) {
	if (components.length === 0) {
		return (
			<Typography color="text.disabled">
				No components currently assigned.
			</Typography>
		);
	}

	const groups = GROUP_ORDER.map((group) => ({
		group,
		items: components.filter((c) => c.assetTypeGroup === group),
	})).filter((g) => g.items.length > 0);

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
			{groups.map(({ group, items }) => (
				<Box key={group}>
					<Typography
						variant="overline"
						sx={{ color: "text.secondary", letterSpacing: 1 }}
					>
						{GROUP_LABEL[group]}
					</Typography>
					<Table size="small">
						<TableHead>
							<TableRow>
								<TableCell>Asset</TableCell>
								<TableCell>
									<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
										Model
										<Tooltip title="Only science sensors, batteries, and hulls have a model tracked today — the schema needs a part-model field added for the other asset types.">
											<InfoOutlinedIcon
												sx={{ fontSize: 15, color: "text.disabled" }}
											/>
										</Tooltip>
									</Box>
								</TableCell>
								<TableCell>Serial number</TableCell>
								<TableCell>Install date</TableCell>
							</TableRow>
						</TableHead>
						<TableBody>
							{items.map((c) => (
								<TableRow key={c.assignmentId}>
									<TableCell sx={{ pl: 2 + (c.depth - 1) * 2 }}>
										{formatAssetType(c.assetType)}
										{c.position && (
											<Box component="span" sx={{ color: "text.secondary" }}>
												{" "}
												({c.position})
											</Box>
										)}
									</TableCell>
									<TableCell>{c.model ?? "—"}</TableCell>
									<TableCell>{c.serialNumber ?? "—"}</TableCell>
									<TableCell>{formatDate(c.installDate)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</Box>
			))}
		</Box>
	);
}
