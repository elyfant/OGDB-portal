"use client";

import DataTable from "@/components/DataTable";
import { RMA_COLUMNS } from "@/lib/rma-columns";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import type { RmaCatalogueRow } from "@ogdb/types";
import { useState } from "react";

export default function RmasTable({ rmas }: { rmas: RmaCatalogueRow[] }) {
	const [showClosed, setShowClosed] = useState(true);
	const rows = showClosed ? rmas : rmas.filter((r) => r.open);

	return (
		<DataTable<RmaCatalogueRow>
			rows={rows}
			columns={RMA_COLUMNS}
			getRowId={(r) => r.id}
			getRowHref={(r) => `/rmas/${r.id}`}
			defaultSort={{ key: "openedDate", direction: "desc" }}
			csvFileNameBase="rmas"
			toolbarRight={
				<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
					<FormControlLabel
						sx={{ m: 0 }}
						control={
							<Checkbox
								size="small"
								checked={showClosed}
								onChange={(e) => setShowClosed(e.target.checked)}
							/>
						}
						label="Show closed"
					/>
				</Box>
			}
		/>
	);
}
