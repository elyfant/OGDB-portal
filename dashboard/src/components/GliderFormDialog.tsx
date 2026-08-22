"use client";

import { createGlider } from "@/lib/api-client";
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
import { type ReactNode, useState } from "react";

interface FormState {
	name: string;
	serialNumber: string;
	wmo: string;
}

function emptyForm(): FormState {
	return { name: "", serialNumber: "", wmo: "" };
}

export default function GliderFormDialog() {
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
		if (!form.name.trim()) {
			setError("Name is required.");
			return;
		}

		setSaving(true);
		try {
			const glider = await createGlider({
				name: form.name.trim(),
				serialNumber: form.serialNumber.trim() || undefined,
				wmo: form.wmo.trim() || undefined,
			});
			closeDialog();
			setBanner({
				severity: "success",
				message: `Glider "${glider.name}" successfully created!`,
			});
		} catch (err) {
			setBanner({
				severity: "error",
				message:
					err instanceof Error ? err.message : "Failed to create glider.",
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
				Add new glider
			</Button>

			<Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
				<DialogTitle>Add new glider</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 3 }}
				>
					<Section label="Details">
						<Grid>
							<Field label="Name" required span={2}>
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
						</Grid>
					</Section>

					<Typography variant="caption" color="text.secondary">
						Platform, manufacturer, owner, and status are set later by editing
						the glider — not part of this form.
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
						{saving ? "Saving…" : "Create glider"}
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
