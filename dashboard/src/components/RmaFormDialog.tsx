"use client";

import { createRma, updateRma } from "@/lib/api-client";
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
import type { LookupOption, Rma } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

interface FormState {
	rmaNumber: string;
	manufacturerId: number | "";
	openedDate: string;
	notes: string;
}

function emptyForm(): FormState {
	return { rmaNumber: "", manufacturerId: "", openedDate: today(), notes: "" };
}

function formFromRma(rma: Rma): FormState {
	return {
		rmaNumber: rma.rmaNumber ?? "",
		manufacturerId: rma.manufacturerId,
		openedDate: rma.openedDate.slice(0, 10),
		notes: rma.notes ?? "",
	};
}

type Props =
	| { mode: "create"; manufacturers: LookupOption[] }
	| { mode: "edit"; rma: Rma; manufacturers: LookupOption[] };

// Same shape as AssetFormDialog -- self-contained trigger button, own
// open state, mode decides create vs. edit.
export default function RmaFormDialog(props: Props) {
	const { mode, manufacturers } = props;
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
		setForm(mode === "edit" ? formFromRma(props.rma) : emptyForm());
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
		if (!form.manufacturerId) {
			setError("Manufacturer is required.");
			return;
		}
		if (!form.openedDate) {
			setError("Opened date is required.");
			return;
		}

		setSaving(true);
		try {
			const rma =
				mode === "edit"
					? await updateRma(props.rma.id, {
							rmaNumber: form.rmaNumber.trim() || null,
							manufacturerId: form.manufacturerId,
							openedDate: form.openedDate,
							notes: form.notes.trim() || null,
						})
					: await createRma({
							rmaNumber: form.rmaNumber.trim() || null,
							manufacturerId: form.manufacturerId,
							openedDate: form.openedDate,
							notes: form.notes.trim() || null,
						});
			closeDialog();
			if (mode === "create") {
				router.push(`/rmas/${rma.id}`);
			}
			setBanner({
				severity: "success",
				message: mode === "edit" ? "RMA updated." : "RMA created.",
			});
		} catch (err) {
			setBanner({
				severity: "error",
				message: err instanceof Error ? err.message : "Failed to save.",
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
				{mode === "edit" ? "Edit RMA" : "New RMA"}
			</Button>

			<Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
				<DialogTitle>{mode === "edit" ? "Edit RMA" : "New RMA"}</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 2 }}
				>
					<Grid>
						<Field label="Manufacturer" required>
							<TextField
								select
								size="small"
								fullWidth
								value={form.manufacturerId}
								onChange={(e) =>
									setForm((s) => ({
										...s,
										manufacturerId: e.target.value
											? Number(e.target.value)
											: "",
									}))
								}
							>
								<MenuItem value="">— choose —</MenuItem>
								{manufacturers.map((m) => (
									<MenuItem key={m.id} value={m.id}>
										{m.name}
									</MenuItem>
								))}
							</TextField>
						</Field>
						<Field label="RMA number">
							<TextField
								size="small"
								fullWidth
								placeholder="e.g. CRO-16571"
								value={form.rmaNumber}
								onChange={(e) =>
									setForm((s) => ({ ...s, rmaNumber: e.target.value }))
								}
							/>
						</Field>
						<Field label="Opened date" required>
							<TextField
								type="date"
								size="small"
								fullWidth
								InputLabelProps={{ shrink: true }}
								value={form.openedDate}
								onChange={(e) =>
									setForm((s) => ({ ...s, openedDate: e.target.value }))
								}
							/>
						</Field>
						<Box />
						<Field label="Notes" span={2}>
							<TextField
								size="small"
								fullWidth
								multiline
								minRows={2}
								placeholder="What's this RMA for, who requested it, which repairer..."
								value={form.notes}
								onChange={(e) =>
									setForm((s) => ({ ...s, notes: e.target.value }))
								}
							/>
						</Field>
					</Grid>

					{mode === "create" && (
						<Typography variant="caption" color="text.secondary">
							Assets are linked from the RMA's own page after it's created.
						</Typography>
					)}

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
								: "Create RMA"}
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
