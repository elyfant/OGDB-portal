import { formatAssetType, formatDate } from "@/lib/format";
import Box from "@mui/material/Box";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { GliderBuildComponent } from "@ogdb/types";

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

	return (
		<TableContainer>
			<Table size="small">
				<TableHead>
					<TableRow>
						<TableCell>Asset</TableCell>
						<TableCell>Serial number</TableCell>
						<TableCell>Install date</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{components.map((c) => (
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
							<TableCell>{c.serialNumber ?? "—"}</TableCell>
							<TableCell>{formatDate(c.installDate)}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
