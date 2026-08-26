"use client";

import { createAsset, updateAsset } from "@/lib/api-client";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import EditIcon from "@mui/icons-material/Edit";
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
import type { Asset, LookupOption } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";

// Matches the gateway's own SENSOR_TYPES set (assets.service.ts) --
// only these asset types have an asset_sensor_details row an L22 model
// can attach to. Duplicated by name rather than by a group id because
// the plain asset-type lookup (LookupOption: {id, name}) doesn't carry
// asset_type_group -- same tradeoff SENSOR_TYPES itself already makes.
const SENSOR_ASSET_TYPE_NAMES = new Set([
	"ct_sensor",
	"do_sensor",
	"eco_sensor",
	"mr_sensor",
]);

interface FormState {
	assetTypeId: number | "";
	serialNumber: string;
	notes: string;
	purchaseDate: string;
	purchaseValueUsd: string;
	instituteId: number | "";
	l22ModelId: number | "";
}

function emptyForm(): FormState {
	return {
		assetTypeId: "",
		serialNumber: "",
		notes: "",
		purchaseDate: "",
		purchaseValueUsd: "",
		instituteId: "",
		l22ModelId: "",
	};
}

// notes isn't part of the Asset read model (assets.service.ts's
// SELECT_ASSETS never selects it -- it's write-only through this form
// today), so edit mode necessarily starts it blank rather than seeded.
// l22ModelId is the exception -- SELECT_ASSETS does expose the sensor's
// current model, so this one field genuinely reflects what's saved.
function formFromAsset(asset: Asset): FormState {
	return {
		assetTypeId: "",
		serialNumber: asset.serialNumber ?? "",
		notes: "",
		purchaseDate: asset.purchaseDate?.slice(0, 10) ?? "",
		purchaseValueUsd: asset.purchaseValueUsd?.toString() ?? "",
		instituteId: "",
		l22ModelId: asset.l22ModelId ?? "",
	};
}

type Props =
	| {
			mode: "create";
			assetTypes: LookupOption[];
			institutes: LookupOption[];
			sensorModels: LookupOption[];
	  }
	| {
			mode: "edit";
			asset: Asset;
			assetTypes: LookupOption[];
			sensorModels: LookupOption[];
	  };

export default function AssetFormDialog(props: Props) {
	const { mode, assetTypes, sensorModels } = props;
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState<FormState>(emptyForm);
	// "science sensor" == the ct/do/eco/mr_sensor group -- only these
	// have an asset_sensor_details row an L22 model can attach to. In
	// edit mode the asset's own group is already known; in create mode
	// it depends on whichever type is currently selected in the form.
	const isSensor =
		mode === "edit"
			? props.asset.assetTypeGroup === "sensor"
			: SENSOR_ASSET_TYPE_NAMES.has(
					assetTypes.find((t) => t.id === form.assetTypeId)?.name ?? "",
				);
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
		setForm(mode === "edit" ? formFromAsset(props.asset) : emptyForm());
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
		if (mode === "create" && !form.assetTypeId) {
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
			const asset =
				mode === "edit"
					? await updateAsset(props.asset.id, {
							serialNumber: form.serialNumber.trim() || null,
							notes: form.notes.trim() || null,
							purchaseDate: form.purchaseDate || null,
							purchaseValueUsd,
							...(isSensor && {
								l22ModelId: form.l22ModelId === "" ? null : form.l22ModelId,
							}),
						})
					: await createAsset({
							assetTypeId: form.assetTypeId as number,
							serialNumber: form.serialNumber.trim() || null,
							notes: form.notes.trim() || null,
							purchaseDate: form.purchaseDate || null,
							purchaseValueUsd,
							instituteId: form.instituteId === "" ? null : form.instituteId,
							...(isSensor && {
								l22ModelId: form.l22ModelId === "" ? null : form.l22ModelId,
							}),
						});
			closeDialog();
			setBanner({
				severity: "success",
				message:
					mode === "edit"
						? "Asset details updated!"
						: `${asset.assetType} asset successfully created!`,
			});
		} catch (err) {
			setBanner({
				severity: "error",
				message:
					err instanceof Error
						? err.message
						: `Failed to ${mode === "edit" ? "update" : "create"} asset.`,
			});
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<Button
				variant="contained"
				size={mode === "edit" ? "small" : undefined}
				startIcon={
					mode === "edit" ? (
						<EditIcon fontSize="small" />
					) : (
						<AddCircleOutlineIcon />
					)
				}
				onClick={handleOpen}
			>
				{mode === "edit" ? "Edit asset details" : "Add new asset"}
			</Button>

			<Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
				<DialogTitle>
					{mode === "edit" ? "Edit asset details" : "Add new asset"}
				</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 3 }}
				>
					<Section label="Details">
						<Grid>
							<Field label="Asset type" required={mode === "create"} span={2}>
								{mode === "edit" ? (
									<TextField
										size="small"
										fullWidth
										disabled
										value={props.asset.assetType}
									/>
								) : (
									<TextField
										select
										size="small"
										fullWidth
										value={form.assetTypeId}
										onChange={(e) =>
											setForm((s) => ({
												...s,
												assetTypeId: e.target.value
													? Number(e.target.value)
													: "",
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
								)}
							</Field>
							{isSensor && (
								<Field label="Asset model" span={2}>
									<TextField
										select
										size="small"
										fullWidth
										value={form.l22ModelId}
										onChange={(e) =>
											setForm((s) => ({
												...s,
												l22ModelId: e.target.value
													? Number(e.target.value)
													: "",
											}))
										}
									>
										<MenuItem value="">— none —</MenuItem>
										{sensorModels.map((m) => (
											<MenuItem key={m.id} value={m.id}>
												{m.name}
											</MenuItem>
										))}
									</TextField>
								</Field>
							)}
							{mode === "create" && (
								<Field label="Institute">
									<TextField
										select
										size="small"
										fullWidth
										value={form.instituteId}
										onChange={(e) =>
											setForm((s) => ({
												...s,
												instituteId: e.target.value
													? Number(e.target.value)
													: "",
											}))
										}
									>
										<MenuItem value="">— none —</MenuItem>
										{props.institutes.map((i) => (
											<MenuItem key={i.id} value={i.id}>
												{i.name}
											</MenuItem>
										))}
									</TextField>
								</Field>
							)}
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
							<Field
								label={mode === "edit" ? "Notes (replaces existing)" : "Notes"}
								span={2}
							>
								<TextField
									size="small"
									fullWidth
									multiline
									minRows={2}
									placeholder={
										mode === "edit"
											? "Leave blank to keep the current notes unchanged"
											: undefined
									}
									value={form.notes}
									onChange={(e) =>
										setForm((s) => ({ ...s, notes: e.target.value }))
									}
								/>
							</Field>
						</Grid>
					</Section>

					<Typography variant="caption" color="text.secondary">
						{mode === "edit"
							? "Manufacturer and most other type-specific details aren't editable here yet. Blank fields keep their current value, except Notes, which replaces whatever's there."
							: 'Manufacturer and most other type-specific details (battery manufacture date, hull details, etc.) aren\'t captured here yet. New assets start with status "Lab".'}
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
						{saving
							? "Saving…"
							: mode === "edit"
								? "Save changes"
								: "Create asset"}
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
