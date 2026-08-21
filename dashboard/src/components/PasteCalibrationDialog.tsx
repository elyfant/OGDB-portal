"use client";

import { recordCalibration } from "@/lib/api-client";
import { CAL_PASTE_MAPPERS, parseCalText } from "@/lib/calibration-paste";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

// Paste-and-parse calibration entry. Only renders for asset types with a
// known paste format (see CAL_PASTE_MAPPERS) -- extend that map to cover
// do_sensor/eco_sensor once their real cal-sheet formats are confirmed,
// nothing else here needs to change.
export default function PasteCalibrationDialog({
	assetId,
	assetType,
}: {
	assetId: number;
	assetType: string;
}) {
	const mapper = CAL_PASTE_MAPPERS[assetType];
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [text, setText] = useState("");
	const [calDate, setCalDate] = useState(today());
	const [certificate, setCertificate] = useState<File | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { coefficients, unmapped } = useMemo(() => {
		if (!mapper || !text.trim()) return { coefficients: {}, unmapped: [] };
		return mapper(parseCalText(text));
	}, [mapper, text]);

	const mappedEntries = Object.entries(coefficients);

	if (!mapper) return null;

	function reset() {
		setText("");
		setCalDate(today());
		setCertificate(null);
		setError(null);
	}

	async function handleSave() {
		setError(null);
		if (!calDate) {
			setError("Pick the calibration date.");
			return;
		}
		if (mappedEntries.length === 0) {
			setError(
				"Nothing recognized to save yet -- paste the calibration text above.",
			);
			return;
		}
		setSaving(true);
		try {
			await recordCalibration(
				assetId,
				{ calDate, coefficients },
				certificate ?? undefined,
			);
			setOpen(false);
			reset();
			router.refresh();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to save calibration.",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<Button
				size="small"
				startIcon={<AddCircleOutlineIcon fontSize="small" />}
				onClick={() => setOpen(true)}
			>
				Add calibration
			</Button>

			<Dialog
				open={open}
				onClose={() => setOpen(false)}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>Paste calibration data</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 2 }}
				>
					<Typography variant="body2" color="text.secondary">
						Paste the calibration-constants block as it appears in
						sg_calib_constants.m. Recognized fields are mapped below — nothing
						is saved until you click Save.
					</Typography>

					<TextField
						multiline
						minRows={8}
						fullWidth
						size="small"
						placeholder={"t_g=4.36266253E-03;\nt_h=6.27190307E-04;\n..."}
						value={text}
						onChange={(e) => setText(e.target.value)}
						sx={{ "& textarea": { fontFamily: "monospace", fontSize: 12 } }}
					/>

					<Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
						<TextField
							size="small"
							type="date"
							label="Calibration date"
							value={calDate}
							onChange={(e) => setCalDate(e.target.value)}
							InputLabelProps={{ shrink: true }}
							sx={{ maxWidth: 220 }}
						/>
						<Button component="label" size="small">
							{certificate ? certificate.name : "Attach certificate (PDF)"}
							<input
								type="file"
								accept="application/pdf"
								hidden
								onChange={(e) => setCertificate(e.target.files?.[0] ?? null)}
							/>
						</Button>
						{certificate && (
							<Button size="small" onClick={() => setCertificate(null)}>
								Remove
							</Button>
						)}
					</Box>

					{mappedEntries.length > 0 && (
						<Box>
							<Typography variant="caption" color="text.secondary">
								{mappedEntries.length} field(s) recognized
							</Typography>
							<Table size="small">
								<TableBody>
									{mappedEntries.map(([column, value]) => (
										<TableRow key={column}>
											<TableCell
												sx={{
													fontFamily: "monospace",
													color: "text.secondary",
												}}
											>
												{column}
											</TableCell>
											<TableCell sx={{ fontFamily: "monospace" }}>
												{String(value)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</Box>
					)}

					{unmapped.length > 0 && (
						<Alert severity="warning">
							{unmapped.length} field(s) not recognized, won't be saved:{" "}
							{unmapped.map((f) => f.name).join(", ")}
						</Alert>
					)}

					{error && (
						<Typography color="error" variant="body2">
							{error}
						</Typography>
					)}
				</DialogContent>
				<DialogActions sx={{ px: 3, py: 1.5 }}>
					<Button onClick={() => setOpen(false)} disabled={saving}>
						Cancel
					</Button>
					<Button variant="contained" onClick={handleSave} disabled={saving}>
						{saving ? "Saving…" : "Save calibration"}
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
}
