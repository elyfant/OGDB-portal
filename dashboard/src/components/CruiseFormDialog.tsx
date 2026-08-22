"use client";

import { createCruise } from "@/lib/api-client";
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

interface FormState {
	cruiseName: string;
	cruiseNumber: string;
	vesselId: number | "";
	instituteId: number | "";
	cruiseLeader: string;
	area: string;
	startDate: string;
	endDate: string;
	startPort: string;
	endPort: string;
}

function emptyForm(): FormState {
	return {
		cruiseName: "",
		cruiseNumber: "",
		vesselId: "",
		instituteId: "",
		cruiseLeader: "",
		area: "",
		startDate: "",
		endDate: "",
		startPort: "",
		endPort: "",
	};
}

export default function CruiseFormDialog({
	vessels,
	institutes,
}: {
	vessels: LookupOption[];
	institutes: LookupOption[];
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
		if (!form.cruiseName.trim()) {
			setError("Cruise name is required.");
			return;
		}
		if (!form.area.trim()) {
			setError("Area is required.");
			return;
		}
		if (!form.startDate) {
			setError("Start date is required.");
			return;
		}
		if (!form.endDate) {
			setError("End date is required.");
			return;
		}
		if (form.endDate < form.startDate) {
			setError("End date can't be before start date.");
			return;
		}

		setSaving(true);
		try {
			const cruise = await createCruise({
				cruiseName: form.cruiseName.trim(),
				cruiseNumber: form.cruiseNumber.trim() || null,
				vesselId: form.vesselId || null,
				instituteId: form.instituteId || null,
				cruiseLeader: form.cruiseLeader.trim() || null,
				area: form.area.trim(),
				startDate: form.startDate,
				endDate: form.endDate,
				startPort: form.startPort.trim() || null,
				endPort: form.endPort.trim() || null,
			});
			closeDialog();
			setBanner({
				severity: "success",
				message: `Cruise "${cruise.cruiseName}" successfully created!`,
			});
		} catch (err) {
			setBanner({
				severity: "error",
				message:
					err instanceof Error ? err.message : "Failed to create cruise.",
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
				Add new cruise
			</Button>

			<Dialog open={open} onClose={closeDialog} maxWidth="md" fullWidth>
				<DialogTitle>Add new cruise</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 3 }}
				>
					<Section label="Identity">
						<Grid>
							<Field label="Cruise name" required span={2}>
								<TextField
									size="small"
									fullWidth
									value={form.cruiseName}
									onChange={(e) =>
										setForm((s) => ({ ...s, cruiseName: e.target.value }))
									}
								/>
							</Field>
							<Field label="Cruise number">
								<TextField
									size="small"
									fullWidth
									value={form.cruiseNumber}
									onChange={(e) =>
										setForm((s) => ({ ...s, cruiseNumber: e.target.value }))
									}
								/>
							</Field>
							<Field label="Vessel">
								<LookupSelect
									value={form.vesselId}
									options={vessels}
									onChange={(v) => setForm((s) => ({ ...s, vesselId: v }))}
								/>
							</Field>
							<Field label="Institute">
								<LookupSelect
									value={form.instituteId}
									options={institutes}
									onChange={(v) => setForm((s) => ({ ...s, instituteId: v }))}
								/>
							</Field>
							<Field label="Cruise leader">
								<TextField
									size="small"
									fullWidth
									value={form.cruiseLeader}
									onChange={(e) =>
										setForm((s) => ({ ...s, cruiseLeader: e.target.value }))
									}
								/>
							</Field>
						</Grid>
					</Section>

					<Section label="Itinerary">
						<Grid>
							<Field label="Area" required>
								<TextField
									size="small"
									fullWidth
									value={form.area}
									onChange={(e) =>
										setForm((s) => ({ ...s, area: e.target.value }))
									}
								/>
							</Field>
							<Field label="Start date" required>
								<TextField
									type="date"
									size="small"
									fullWidth
									InputLabelProps={{ shrink: true }}
									value={form.startDate}
									onChange={(e) =>
										setForm((s) => ({ ...s, startDate: e.target.value }))
									}
								/>
							</Field>
							<Field label="Start port">
								<TextField
									size="small"
									fullWidth
									value={form.startPort}
									onChange={(e) =>
										setForm((s) => ({ ...s, startPort: e.target.value }))
									}
								/>
							</Field>
							<Box />
							<Field label="End date" required>
								<TextField
									type="date"
									size="small"
									fullWidth
									InputLabelProps={{ shrink: true }}
									value={form.endDate}
									onChange={(e) =>
										setForm((s) => ({ ...s, endDate: e.target.value }))
									}
								/>
							</Field>
							<Field label="End port">
								<TextField
									size="small"
									fullWidth
									value={form.endPort}
									onChange={(e) =>
										setForm((s) => ({ ...s, endPort: e.target.value }))
									}
								/>
							</Field>
						</Grid>
					</Section>

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
						{saving ? "Saving…" : "Create cruise"}
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
