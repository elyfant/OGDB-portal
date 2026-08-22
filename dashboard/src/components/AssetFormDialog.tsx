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
import { type ReactNode, useMemo, useState } from "react";

interface FormState {
	assetTypeId: number | "";
	serialNumber: string;
	notes: string;
	purchaseDate: string;
	purchaseValueUsd: string;
}

function emptyForm(): FormState {
	return {
		assetTypeId: "",
		serialNumber: "",
		notes: "",
		purchaseDate: "",
		purchaseValueUsd: "",
	};
}

export default function AssetFormDialog({
	assetTypes,
}: {
	assetTypes: LookupOption[];
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

	// Gliders have their own creation flow (Fleet page) with a detail
	// table this form doesn't know how to populate — not offered here.
	const creatableAssetTypes = useMemo(
		() => assetTypes.filter((t) => t.name !== "glider"),
		[assetTypes],
	);

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
		if (!form.assetTypeId) {
			setError("Asset type is required.");
			return;
		}
		const purchaseValueUsd =
			form.purchaseValueUsd.trim() === ""
				? null
				: Number(form.purchaseValueUsd);
		if (purchaseValueUsd !== null && Number.isNaN(purchaseValueUsd)) {
			setError("Purchase value must be a number.");
			return;
		}

		setSaving(true);
		try {
			const asset = await createAsset({
				assetTypeId: form.assetTypeId,
				serialNumber: form.serialNumber.trim() || null,
				notes: form.notes.trim() || null,
				purchaseDate: form.purchaseDate || null,
				purchaseValueUsd,
			});
			closeDialog();
			setBanner({
				severity: "success",
				message: `${asset.assetType} asset successfully created!`,
			});
		} catch (err) {
			setBanner({
				severity: "error",
				message: err instanceof Error ? err.message : "Failed to create asset.",
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
				Add new asset
			</Button>

			<Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
				<DialogTitle>Add new asset</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 3 }}
				>
					<Section label="Details">
						<Grid>
							<Field label="Asset type" required span={2}>
								<TextField
									select
									size="small"
									fullWidth
									value={form.assetTypeId}
									onChange={(e) =>
										setForm((s) => ({
											...s,
											assetTypeId: e.target.value ? Number(e.target.value) : "",
										}))
									}
								>
									<MenuItem value="">— choose a type —</MenuItem>
									{creatableAssetTypes.map((t) => (
										<MenuItem key={t.id} value={t.id}>
											{t.name}
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
							<Box />
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
										setForm((s) => ({ ...s, purchaseValueUsd: e.target.value }))
									}
								/>
							</Field>
							<Field label="Notes" span={2}>
								<TextField
									size="small"
									fullWidth
									multiline
									minRows={2}
									value={form.notes}
									onChange={(e) =>
										setForm((s) => ({ ...s, notes: e.target.value }))
									}
								/>
							</Field>
						</Grid>
					</Section>

					<Typography variant="caption" color="text.secondary">
						Generic fields only — manufacturer and any type-specific details
						(battery manufacture date, hull details, sensor model, etc.) aren't
						captured here yet. New assets start with status "Lab".
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
						{saving ? "Saving…" : "Create asset"}
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
	required,
	span,
	children,
}: {
	label: string;
	required?: boolean;
	span?: number;
	children: ReactNode;
}) {
	return (
		<Box sx={{ gridColumn: span ? `span ${span}` : undefined }}>
			<Typography
				variant="caption"
				sx={{ display: "block", mb: 0.5, fontWeight: 600 }}
			>
				{label}
				{required && (
					<Box component="span" sx={{ color: "error.main", ml: 0.3 }}>
						*
					</Box>
				)}
			</Typography>
			{children}
		</Box>
	);
}
