"use client";

import { recordBatteryMeasurement } from "@/lib/api-client";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useState } from "react";

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

// Records a dated weight and/or voltage reading as a new row in the
// battery's append-only measurement history -- never an edit of an
// earlier reading. Either value can be left blank (a voltage-only check
// is common), but not both.
export default function AddBatteryMeasurementDialog({
	assetId,
}: {
	assetId: number;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [date, setDate] = useState(today);
	const [weight, setWeight] = useState("");
	const [voltage, setVoltage] = useState("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [banner, setBanner] = useState<string | null>(null);

	function handleOpen() {
		setDate(today());
		setWeight("");
		setVoltage("");
		setError(null);
		setOpen(true);
	}

	function dismissBanner() {
		setBanner(null);
		router.refresh();
	}

	async function handleSave() {
		setError(null);
		const w = weight.trim() === "" ? null : Number(weight);
		const v = voltage.trim() === "" ? null : Number(voltage);
		if (w === null && v === null) {
			setError("Enter a weight or a voltage.");
			return;
		}
		if ((w !== null && Number.isNaN(w)) || (v !== null && Number.isNaN(v))) {
			setError("Weight and voltage must be numbers.");
			return;
		}
		if (!date) {
			setError("Date is required.");
			return;
		}

		setSaving(true);
		try {
			await recordBatteryMeasurement(assetId, {
				measuredDate: date,
				weight: w,
				voltage: v,
			});
			setOpen(false);
			setBanner("Measurement added!");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to add measurement.",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<Button
				variant="outlined"
				size="small"
				startIcon={<AddCircleOutlineIcon fontSize="small" />}
				onClick={handleOpen}
			>
				Add measurement
			</Button>

			<Dialog
				open={open}
				onClose={() => setOpen(false)}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle>Add measurement</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 2 }}
				>
					<Box>
						<Typography
							variant="caption"
							sx={{ display: "block", mb: 0.5, fontWeight: 600 }}
						>
							Date measured
						</Typography>
						<TextField
							type="date"
							size="small"
							fullWidth
							InputLabelProps={{ shrink: true }}
							value={date}
							onChange={(e) => setDate(e.target.value)}
						/>
					</Box>
					<Box>
						<Typography
							variant="caption"
							sx={{ display: "block", mb: 0.5, fontWeight: 600 }}
						>
							Weight (g)
						</Typography>
						<TextField
							type="number"
							size="small"
							fullWidth
							value={weight}
							onChange={(e) => setWeight(e.target.value)}
						/>
					</Box>
					<Box>
						<Typography
							variant="caption"
							sx={{ display: "block", mb: 0.5, fontWeight: 600 }}
						>
							Voltage (V)
						</Typography>
						<TextField
							type="number"
							size="small"
							fullWidth
							value={voltage}
							onChange={(e) => setVoltage(e.target.value)}
						/>
					</Box>
					<Typography variant="caption" color="text.secondary">
						Enter a weight, a voltage, or both. Each measurement is added to the
						battery's history; earlier readings are never overwritten.
					</Typography>
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
						{saving ? "Saving…" : "Add measurement"}
					</Button>
				</DialogActions>
			</Dialog>

			<Snackbar
				open={banner !== null}
				onClose={dismissBanner}
				anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
			>
				<Alert
					severity="success"
					variant="filled"
					sx={{ maxWidth: 480 }}
					action={
						<Button color="inherit" size="small" onClick={dismissBanner}>
							OK
						</Button>
					}
				>
					{banner}
				</Alert>
			</Snackbar>
		</>
	);
}
