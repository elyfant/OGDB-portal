import { formatAssetType, formatDate } from "@/lib/format";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Box from "@mui/material/Box";
import MuiLink from "@mui/material/Link";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
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

// Fixed so the Asset/Model/Serial/Install date columns line up across
// every group's table, not just within one — each group renders its own
// <Table> (for the section heading above it), so without an explicit,
// shared column layout each one auto-sizes independently.
const COLUMN_WIDTHS = ["34%", "34%", "17%", "15%"];

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

	const typeByAssetId = new Map(
		components.map((c) => [c.assetId, c.assetType]),
	);

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
							{items.map((c) => {
								const parentType = typeByAssetId.get(c.parentAssetId);
								const mountedIn =
									c.depth > 1 && parentType
										? formatAssetType(parentType)
										: null;
								return (
									<TableRow key={c.assignmentId}>
										<TableCell>
											{formatAssetType(c.assetType)}
											{c.position && (
												<Box component="span" sx={{ color: "text.secondary" }}>
													{" "}
													({c.position})
												</Box>
											)}
											{mountedIn && (
												<Box component="span" sx={{ color: "text.secondary" }}>
													{" "}
													(mounted in {mountedIn.toLowerCase()})
												</Box>
											)}
										</TableCell>
										<TableCell>
											<Box
												sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
											>
												{c.model ?? "—"}
												{c.modelUri && (
													<MuiLink
														href={c.modelUri}
														target="_blank"
														rel="noreferrer"
														sx={{
															display: "inline-flex",
															color: "text.secondary",
														}}
													>
														<InfoOutlinedIcon sx={{ fontSize: 15 }} />
													</MuiLink>
												)}
											</Box>
										</TableCell>
										<TableCell>{c.serialNumber ?? "—"}</TableCell>
										<TableCell>{formatDate(c.installDate)}</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</Box>
			))}
		</Box>
	);
}
