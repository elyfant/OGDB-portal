"use client";

import { createGlider, updateGlider } from "@/lib/api-client";
import { formatDate, formatUsd } from "@/lib/format";
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
import type { Glider, LookupOption } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

interface FormState {
	name: string;
	serialNumber: string;
	wmo: string;
	platformId: number | "";
	instituteId: number | "";
	purchaseDate: string;
	purchaseValueUsd: string;
}

function emptyForm(): FormState {
	return {
		name: "",
		serialNumber: "",
		wmo: "",
		platformId: "",
		instituteId: "",
		purchaseDate: "",
		purchaseValueUsd: "",
	};
}

function formFromGlider(g: Glider): FormState {
	return {
		name: g.name,
		serialNumber: g.serialNumber ?? "",
		wmo: g.wmo ?? "",
		platformId: g.platformId ?? "",
		instituteId: g.instituteId ?? "",
		purchaseDate: g.purchaseDate?.slice(0, 10) ?? "",
		purchaseValueUsd: g.purchaseValueUsd?.toString() ?? "",
	};
}

const FIELD_LABELS: { key: keyof FormState; label: string }[] = [
	{ key: "name", label: "Name" },
	{ key: "serialNumber", label: "Serial number" },
	{ key: "wmo", label: "WMO" },
	{ key: "platformId", label: "Platform" },
	{ key: "instituteId", label: "Owner" },
	{ key: "purchaseDate", label: "Purchase date" },
	{ key: "purchaseValueUsd", label: "Purchase value" },
];

function displayValue(
	key: keyof FormState,
	value: FormState[keyof FormState],
	platforms: LookupOption[],
	institutes: LookupOption[],
): string {
	if (value === "" || value === null || value === undefined) return "—";
	if (key === "platformId") {
		return platforms.find((p) => p.id === value)?.name ?? "—";
	}
	if (key === "instituteId") {
		return institutes.find((i) => i.id === value)?.name ?? "—";
	}
	if (key === "purchaseDate") return formatDate(String(value));
	if (key === "purchaseValueUsd") return formatUsd(Number(value));
	return String(value);
}

function summarizeChanges(
	before: FormState,
	after: FormState,
	platforms: LookupOption[],
	institutes: LookupOption[],
): string[] {
	return FIELD_LABELS.filter(({ key }) => before[key] !== after[key]).map(
		({ key, label }) =>
			`${label}: ${displayValue(key, before[key], platforms, institutes)} → ${displayValue(key, after[key], platforms, institutes)}`,
	);
}

type Props =
	| { mode: "create"; platforms: LookupOption[]; institutes: LookupOption[] }
	| {
			mode: "edit";
			glider: Glider;
			platforms: LookupOption[];
			institutes: LookupOption[];
	  };

export default function GliderFormDialog(props: Props) {
	const { mode, platforms, institutes } = props;
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState<FormState>(emptyForm);
	const [initialForm, setInitialForm] = useState<FormState>(emptyForm);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [banner, setBanner] = useState<{
		severity: "success" | "error";
		message: string;
		changes?: string[];
	} | null>(null);

	function handleOpen() {
		const initial =
			mode === "edit" ? formFromGlider(props.glider) : emptyForm();
		setForm(initial);
		setInitialForm(initial);
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
		if (!form.name.trim()) {
			setError("Name is required.");
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
			const payload = {
				name: form.name.trim(),
				serialNumber: form.serialNumber.trim() || undefined,
				wmo: form.wmo.trim() || undefined,
				platformId: form.platformId || undefined,
				instituteId: form.instituteId || undefined,
				purchaseDate: form.purchaseDate || undefined,
				purchaseValueUsd: purchaseValueUsd ?? undefined,
			};
			const glider =
				mode === "edit"
					? await updateGlider(props.glider.id, payload)
					: await createGlider(payload);
			closeDialog();
			if (mode === "edit") {
				const changes = summarizeChanges(
					initialForm,
					form,
					platforms,
					institutes,
				);
				setBanner({
					severity: "success",
					message: `Glider "${glider.name}" successfully updated!`,
					changes,
				});
			} else {
				setBanner({
					severity: "success",
					message: `Glider "${glider.name}" successfully created!`,
				});
			}
		} catch (err) {
			setBanner({
				severity: "error",
				message:
					err instanceof Error
						? err.message
						: `Failed to ${mode === "edit" ? "update" : "create"} glider.`,
			});
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<Button
				variant="contained"
				startIcon={mode === "edit" ? <EditIcon /> : <AddCircleOutlineIcon />}
				onClick={handleOpen}
			>
				{mode === "edit" ? "Edit glider details" : "Add new glider"}
			</Button>

			<Dialog open={open} onClose={closeDialog} maxWidth="md" fullWidth>
				<DialogTitle>
					{mode === "edit" ? "Edit glider details" : "Add new glider"}
				</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 3 }}
				>
					<Section label="Details">
						<Grid>
							<Field label="Name" required span={3}>
								<TextField
									size="small"
									fullWidth
									value={form.name}
									onChange={(e) =>
										setForm((s) => ({ ...s, name: e.target.value }))
									}
								/>
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
							<Field label="WMO">
								<TextField
									size="small"
									fullWidth
									value={form.wmo}
									onChange={(e) =>
										setForm((s) => ({ ...s, wmo: e.target.value }))
									}
								/>
							</Field>
							<Field label="Platform">
								<LookupSelect
									value={form.platformId}
									options={platforms}
									onChange={(v) => setForm((s) => ({ ...s, platformId: v }))}
								/>
							</Field>
							<Field label="Owner">
								<LookupSelect
									value={form.instituteId}
									options={institutes}
									onChange={(v) => setForm((s) => ({ ...s, instituteId: v }))}
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
						</Grid>
					</Section>

					<Typography variant="caption" color="text.secondary">
						Manufacturer is set later by editing the glider — not part of this
						form.
						{mode === "create" && ' New gliders start with status "Lab".'}
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
								: "Create glider"}
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
					{banner?.changes && banner.changes.length > 0 && (
						<Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
							{banner.changes.map((c) => (
								<li key={c}>
									<Typography variant="caption">{c}</Typography>
								</li>
							))}
						</Box>
					)}
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
				gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
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

function LookupSelect({
	value,
	options,
	onChange,
}: {
	value: number | "";
	options: LookupOption[];
	onChange: (value: number | "") => void;
}) {
	return (
		<TextField
			select
			size="small"
			fullWidth
			value={value}
			onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
		>
			<MenuItem value="">—</MenuItem>
			{options.map((o) => (
				<MenuItem key={o.id} value={o.id}>
					{o.name}
				</MenuItem>
			))}
		</TextField>
	);
}
