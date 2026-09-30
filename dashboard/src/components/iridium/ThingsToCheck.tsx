import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Typography from "@mui/material/Typography";

// The latest push's warnings, verbatim from iridium-costs. Fixes belong
// at the source (a mission date, an IMEI in OGDB), then a new push.
export default function ThingsToCheck({ warnings }: { warnings: string[] }) {
	if (warnings.length === 0) return null;
	return (
		<Accordion
			variant="outlined"
			disableGutters
			sx={{ mb: 3, borderColor: "warning.main" }}
		>
			<AccordionSummary expandIcon={<ExpandMoreIcon />}>
				<WarningAmberIcon color="warning" sx={{ mr: 1 }} />
				<Typography>
					{warnings.length} thing{warnings.length === 1 ? "" : "s"} to check
				</Typography>
			</AccordionSummary>
			<AccordionDetails>
				<Typography component="ul" variant="body2" sx={{ m: 0, pl: 2.5 }}>
					{warnings.map((w) => (
						<li key={w} style={{ marginBottom: 6 }}>
							{w}
						</li>
					))}
				</Typography>
				<Typography variant="caption" color="text.secondary">
					Fix these at the source (mission dates, SIM/IMEI numbers in OGDB),
					then run iridium-costs push again.
				</Typography>
			</AccordionDetails>
		</Accordion>
	);
}
