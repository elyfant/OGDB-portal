"use client";

import ClickableTableRow from "@/components/ClickableTableRow";
import StatusEditor from "@/components/StatusEditor";
import { formatDate } from "@/lib/format";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import type { AssetStatusOption, Glider } from "@ogdb/types";
import { useState } from "react";

export default function GlidersTable({
	gliders,
	statusOptions,
	canEdit,
}: {
	gliders: Glider[];
	statusOptions: AssetStatusOption[];
	canEdit: boolean;
}) {
	const [showDecommissioned, setShowDecommissioned] = useState(false);

	const visibleGliders = showDecommissioned
		? gliders
		: gliders.filter((g) => g.status !== "decommissioned");

	return (
		<Box>
			<TableContainer component={Paper}>
				<Table>
					<TableHead>
						<TableRow>
							<TableCell>Name</TableCell>
							<TableCell>Serial number</TableCell>
							<TableCell>WMO</TableCell>
							<TableCell>Platform</TableCell>
							<TableCell>Manufacturer</TableCell>
							<TableCell>Purchase date</TableCell>
							<TableCell>Status</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{visibleGliders.map((glider) => (
							<ClickableTableRow key={glider.id} href={`/gliders/${glider.id}`}>
								<TableCell sx={{ textTransform: "capitalize" }}>
									{glider.name}
								</TableCell>
								<TableCell>{glider.serialNumber ?? "—"}</TableCell>
								<TableCell>{glider.wmo ?? "—"}</TableCell>
								<TableCell sx={{ textTransform: "capitalize" }}>
									{glider.platform
										? [glider.platform, glider.platformModel]
												.filter(Boolean)
												.join(" ")
										: "—"}
								</TableCell>
								<TableCell>{glider.manufacturer ?? "—"}</TableCell>
								<TableCell>{formatDate(glider.purchaseDate)}</TableCell>
								<TableCell>
									<StatusEditor
										kind="gliders"
										id={glider.id}
										statusId={glider.statusId}
										options={statusOptions}
										disabled={!canEdit}
									/>
								</TableCell>
							</ClickableTableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
			<Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
				<FormControlLabel
					control={
						<Checkbox
							size="small"
							checked={showDecommissioned}
							onChange={(e) => setShowDecommissioned(e.target.checked)}
						/>
					}
					label="Show decommissioned gliders"
				/>
			</Box>
		</Box>
	);
}
