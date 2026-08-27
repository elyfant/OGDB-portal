"use client";

import { createAsset } from "@/lib/api-client";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { LookupOption } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

// A battery is created through the generic asset-create endpoint, same as
// every non-glider asset -- the "Add new asset" form's own path. The
// asset type is fixed to "battery" here (no type picker), and the
// battery-specific fields (model, date of manufacture, weight) ride along
// on CreateAssetInput; the gateway routes them to asset_battery_details /
// asset_battery_measurements once it sees the type is "battery".
interface FormState {
	instituteId: number | "";
	serialNumber: string;
	purchaseDate: string;
	purchaseValueUsd: string;
	batteryModelId: number | "";
	dateOfManufacture: string;
	weight: string;
}

function emptyForm(): FormState {
	return {
		instituteId: "",
		serialNumber: "",
		purchaseDate: "",
		purchaseValueUsd: "",
		batteryModelId: "",
		dateOfManufacture: "",
		weight: "",
	};
}

export default function BatteryFormDialog({
	batteryAssetTypeId,
	institutes,
	batteryModels,
}: {
	batteryAssetTypeId: number;
	institutes: LookupOption[];
	batteryModels: LookupOption[];
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState<FormState>(emptyForm);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [banner, setBanner] = useState<{
		severity: "success" | "error";
		message: string;
	} | null>(null);

	function handleOpen() {
		setForm(emptyForm());
		setError(null);
		setOpen(true);
	}

	function closeDialog() {
		setOpen(false);
	}

	function dismissBanner() {
		setBanner(null);
		router.refresh();
	}

	async function handleSave() {
		setError(null);

		const purchaseValueUsd =
			form.purchaseValueUsd.trim() === ""
				? null
				: Number(form.purchaseValueUsd);
		if (purchaseValueUsd !== null && Number.isNaN(purchaseValueUsd)) {
			setError("Purchase value must be a number.");
			return;
		}
		const weight = form.weight.trim() === "" ? null : Number(form.weight);
		if (weight !== null && Number.isNaN(weight)) {
			setError("Weight must be a number.");
			return;
		}

		setSaving(true);
		try {
			await createAsset({
				assetTypeId: batteryAssetTypeId,
				serialNumber: form.serialNumber.trim() || null,
				purchaseDate: form.purchaseDate || null,
				purchaseValueUsd,
				instituteId: form.instituteId === "" ? null : form.instituteId,
				batteryModelId: form.batteryModelId === "" ? null : form.batteryModelId,
				dateOfManufacture: form.dateOfManufacture || null,
				weight,
			});
			closeDialog();
			setBanner({
				severity: "success",
				message: "Battery pack successfully created!",
			});
		} catch (err) {
			setBanner({
				severity: "error",
				message:
					err instanceof Error ? err.message : "Failed to create battery pack.",
			});
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<Button
				variant="contained"
				startIcon={<AddCircleOutlineIcon />}
				onClick={handleOpen}
			>
				Add new battery pack
			</Button>

			<Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
				<DialogTitle>Add new battery</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 3 }}
				>
					<Section label="Details">
						<Grid>
							<Field label="Institute">
								<TextField
									select
									size="small"
									fullWidth
									value={form.instituteId}
									onChange={(e) =>
										setForm((s) => ({
											...s,
											instituteId: e.target.value ? Number(e.target.value) : "",
										}))
									}
								>
									<MenuItem value="">— none —</MenuItem>
									{institutes.map((i) => (
										<MenuItem key={i.id} value={i.id}>
											{i.name}
										</MenuItem>
									))}
								</TextField>
							</Field>
							<Field label="Serial number">
								<TextField
									size="small"
									fullWidth
									value={form.serialNumber}
									onChange={(e) =>
										setForm((s) => ({ ...s, serialNumber: e.target.value }))
									}
								/>
							</Field>
							<Field label="Purchase date">
								<TextField
									type="date"
									size="small"
									fullWidth
									InputLabelProps={{ shrink: true }}
									value={form.purchaseDate}
									onChange={(e) =>
										setForm((s) => ({ ...s, purchaseDate: e.target.value }))
									}
								/>
							</Field>
							<Field label="Purchase value (USD)">
								<TextField
									type="number"
									size="small"
									fullWidth
									value={form.purchaseValueUsd}
									onChange={(e) =>
										setForm((s) => ({
											...s,
											purchaseValueUsd: e.target.value,
										}))
									}
								/>
							</Field>
							<Field label="Battery model">
								<TextField
									select
									size="small"
									fullWidth
									value={form.batteryModelId}
									onChange={(e) =>
										setForm((s) => ({
											...s,
											batteryModelId: e.target.value
												? Number(e.target.value)
												: "",
										}))
									}
								>
									<MenuItem value="">— none —</MenuItem>
									{batteryModels.map((m) => (
										<MenuItem key={m.id} value={m.id}>
											{m.name}
										</MenuItem>
									))}
								</TextField>
							</Field>
							<Field label="Date of manufacture">
								<TextField
									type="date"
									size="small"
									fullWidth
									InputLabelProps={{ shrink: true }}
									value={form.dateOfManufacture}
									onChange={(e) =>
										setForm((s) => ({
											...s,
											dateOfManufacture: e.target.value,
										}))
									}
								/>
							</Field>
							<Field label="Weight (g)">
								<TextField
									type="number"
									size="small"
									fullWidth
									value={form.weight}
									onChange={(e) =>
										setForm((s) => ({ ...s, weight: e.target.value }))
									}
								/>
							</Field>
						</Grid>
					</Section>

					<Typography variant="caption" color="text.secondary">
						New batteries start with status "Lab". Weight is recorded as the
						first entry in the battery's measurement history and can be
						re-measured over its life from the battery's detail page.
					</Typography>

					{error && (
						<Typography color="error" variant="body2">
							{error}
						</Typography>
					)}
				</DialogContent>
				<DialogActions sx={{ px: 3, py: 1.5 }}>
					<Button onClick={closeDialog} disabled={saving}>
						Cancel
					</Button>
					<Button variant="contained" onClick={handleSave} disabled={saving}>
						{saving ? "Saving…" : "Create battery"}
					</Button>
				</DialogActions>
			</Dialog>

			<Snackbar
				open={banner !== null}
				onClose={dismissBanner}
				anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
			>
				<Alert
					severity={banner?.severity}
					variant="filled"
					sx={{ maxWidth: 480 }}
					action={
						<Button color="inherit" size="small" onClick={dismissBanner}>
							OK
						</Button>
					}
				>
					{banner?.message}
				</Alert>
			</Snackbar>
		</>
	);
}

function Section({ label, children }: { label: string; children: ReactNode }) {
	return (
		<Box>
			<Typography
				variant="overline"
				color="text.secondary"
				sx={{ display: "block", mb: 1, letterSpacing: 1 }}
			>
				{label}
			</Typography>
			{children}
		</Box>
	);
}

function Grid({ children }: { children: ReactNode }) {
	return (
		<Box
			sx={{
				display: "grid",
				gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)" },
				gap: 2,
			}}
		>
			{children}
		</Box>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: ReactNode;
}) {
	return (
		<Box>
			<Typography
				variant="caption"
				sx={{ display: "block", mb: 0.5, fontWeight: 600 }}
			>
				{label}
			</Typography>
			{children}
		</Box>
	);
}
