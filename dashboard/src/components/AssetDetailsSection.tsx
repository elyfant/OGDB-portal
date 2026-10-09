import Field from "@/components/Field";
import {
	formatAssetType,
	formatFieldName,
	formatFieldValue,
} from "@/lib/format";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { AssetDetails } from "@ogdb/types";

// Read-only dump of every column in the asset's per-type detail table
// (GET /assets/:id/details). Deliberately generic -- no per-type layout --
// so a column added in the database shows up here without a code change.
// Edited directly in the database; there is no edit control on purpose.
export default function AssetDetailsSection({
	details,
}: {
	details: AssetDetails;
}) {
	if (details.fields === null) return null;
	const entries = Object.entries(details.fields);

	return (
		<Accordion disableGutters sx={{ mb: 3 }}>
			<AccordionSummary expandIcon={<ExpandMoreIcon />}>
				<Typography>{formatAssetType(details.assetType)} details</Typography>
			</AccordionSummary>
			<AccordionDetails>
				{entries.length === 0 ? (
					<Typography color="text.disabled">
						No detail record yet for this asset.
					</Typography>
				) : (
					<Box
						sx={{
							display: "grid",
							gridTemplateColumns: {
								xs: "repeat(2, 1fr)",
								md: "repeat(4, 1fr)",
							},
							gap: 3,
						}}
					>
						{entries.map(([field, value]) => (
							<Field
								key={field}
								label={formatFieldName(field)}
								value={formatFieldValue(value === "" ? null : value)}
							/>
						))}
					</Box>
				)}
			</AccordionDetails>
		</Accordion>
	);
}
