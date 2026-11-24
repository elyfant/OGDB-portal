"use client";

import { saveRefurbVacuum } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { RefurbVacuum } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

// A pulled hull should read about 9 psia, plus or minus 0.2.
const TARGET_PSIA = 9;
const TOLERANCE_PSIA = 0.2;

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const numOrNull = (s: string) =>
	s.trim() === "" ? null : Number(s.replace(",", "."));

function initialForm(v: RefurbVacuum) {
	return {
		cablesChecked: v.cablesChecked,
		oringsServiced: v.oringsServiced,
		gliderClosed: v.gliderClosed,
		vacuumPulled: v.vacuumPulled,
		pressureBeforePsia: str(v.pressureBeforePsia),
		pressurePulledPsia: str(v.pressurePulledPsia),
		pressureSettledPsia: str(v.pressureSettledPsia),
		humidityRh: str(v.humidityRh),
		anodeContinuityOk:
			v.anodeContinuityOk === null ? "" : String(v.anodeContinuityOk),
		notes: str(v.notes),
	};
}

// Section 8 of the refurbishment logsheet: close the glider, pull a vacuum
// and read the internal pressure. Pressures are numbers in psia; a reading
// outside 9 ± 0.2 is flagged but never refused, so the tech can record it and
// say why.
export default function VacuumSection({
	missionId,
	data,
	canEdit,
}: {
	missionId: number;
	data: RefurbVacuum;
	canEdit: boolean;
}) {
	const router = useRouter();
	const initial = initialForm(data);
	const [form, setForm] = useState(initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const dirty = JSON.stringify(form) !== JSON.stringify(initial);
	const disabled = !canEdit || busy;
	const set = (patch: Partial<typeof form>) =>
		setForm((f) => ({ ...f, ...patch }));

	const pulled = numOrNull(form.pressurePulledPsia);
	const settled = numOrNull(form.pressureSettledPsia);
	const offTarget = (p: number | null) =>
		p !== null && Math.abs(p - TARGET_PSIA) > TOLERANCE_PSIA;
	const rise = pulled !== null && settled !== null ? settled - pulled : null;

	async function save() {
		setBusy(true);
		setError(null);
		try {
			await saveRefurbVacuum(missionId, {
				cablesChecked: form.cablesChecked,
				oringsServiced: form.oringsServiced,
				gliderClosed: form.gliderClosed,
				vacuumPulled: form.vacuumPulled,
				pressureBeforePsia: numOrNull(form.pressureBeforePsia),
				pressurePulledPsia: numOrNull(form.pressurePulledPsia),
				pressureSettledPsia: numOrNull(form.pressureSettledPsia),
				humidityRh: numOrNull(form.humidityRh),
				anodeContinuityOk:
					form.anodeContinuityOk === ""
						? null
						: form.anodeContinuityOk === "true",
				notes: form.notes.trim() || null,
			});
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save.");
		} finally {
			setBusy(false);
		}
	}

	const step = (
		key: "cablesChecked" | "oringsServiced" | "gliderClosed" | "vacuumPulled",
		label: string,
		hint?: string,
	) => (
		<Box>
			<FormControlLabel
				control={
					<Checkbox
						checked={form[key]}
						disabled={disabled}
						onChange={(e) => set({ [key]: e.target.checked })}
					/>
				}
				label={label}
			/>
			{hint && (
				<Typography
					variant="caption"
					color="text.secondary"
					display="block"
					sx={{ ml: 4, mt: -0.5 }}
				>
					{hint}
				</Typography>
			)}
		</Box>
	);

	const pressure = (
		key: "pressureBeforePsia" | "pressurePulledPsia" | "pressureSettledPsia",
		label: string,
		help: string,
	) => (
		<TextField
			size="small"
			label={`${label} (psia)`}
			value={form[key]}
			onChange={(e) => set({ [key]: e.target.value })}
			disabled={disabled}
			helperText={help}
			slotProps={{ htmlInput: { inputMode: "decimal" } }}
		/>
	);

	return (
		<Box>
			<Paper variant="outlined" sx={{ p: 2 }}>
				<Stack>
					{step(
						"cablesChecked",
						"Cables checked by changing roll and pitch",
						"Communicate with the glider before closing it.",
					)}
					{step("oringsServiced", "O-rings cleaned and changed or greased")}
					{step("gliderClosed", "Glider closed")}
					{step(
						"vacuumPulled",
						"Vacuum pulled",
						"Tighten the valve all the way up. Turn it counterclockwise 6 entire turns (open). Pull the vacuum. Turn it clockwise 2 turns to seal.",
					)}
				</Stack>

				<Box
					sx={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
						gap: 2,
						mt: 2,
					}}
				>
					{pressure(
						"pressureBeforePsia",
						"Pressure before pulling",
						"About 14 psia without a vacuum.",
					)}
					{pressure(
						"pressurePulledPsia",
						"Pressure after pulling",
						`Target ${TARGET_PSIA} ± ${TOLERANCE_PSIA} psia.`,
					)}
					{pressure(
						"pressureSettledPsia",
						"Pressure after settling",
						"Read again after about 5 minutes.",
					)}
					<TextField
						size="small"
						label="Relative humidity (% RH)"
						value={form.humidityRh}
						onChange={(e) => set({ humidityRh: e.target.value })}
						disabled={disabled}
						slotProps={{ htmlInput: { inputMode: "decimal" } }}
					/>
					<TextField
						select
						size="small"
						label="Anode continuity OK?"
						value={form.anodeContinuityOk}
						onChange={(e) => set({ anodeContinuityOk: e.target.value })}
						disabled={disabled}
					>
						<MenuItem value="">—</MenuItem>
						<MenuItem value="true">Yes</MenuItem>
						<MenuItem value="false">No</MenuItem>
					</TextField>
				</Box>

				{(offTarget(pulled) || offTarget(settled)) && (
					<Alert severity="warning" sx={{ mt: 1.5 }}>
						{offTarget(pulled) && offTarget(settled)
							? "Both readings are"
							: offTarget(pulled)
								? "The pulled reading is"
								: "The settled reading is"}{" "}
						outside {TARGET_PSIA} ± {TOLERANCE_PSIA} psia. Say why in the notes
						if it is accepted.
					</Alert>
				)}
				{rise !== null && (
					<Typography variant="body2" sx={{ mt: 1.5 }}>
						Pressure {rise >= 0 ? "rose" : "fell"} by{" "}
						<strong>{Math.abs(rise).toFixed(2)} psia</strong> while settling.
						{rise > 0 && " A rise can mean a leak."}
					</Typography>
				)}

				<TextField
					size="small"
					fullWidth
					multiline
					minRows={2}
					label="Notes"
					value={form.notes}
					onChange={(e) => set({ notes: e.target.value })}
					disabled={disabled}
					sx={{ mt: 2 }}
				/>

				{error && (
					<Alert
						severity="error"
						sx={{ mt: 1.5 }}
						onClose={() => setError(null)}
					>
						{error}
					</Alert>
				)}
				{data.updatedAt && (
					<Typography
						variant="caption"
						color="text.secondary"
						display="block"
						sx={{ mt: 1 }}
					>
						Last saved {formatDate(data.updatedAt)}
						{data.updatedByName ? ` by ${data.updatedByName}` : ""}
					</Typography>
				)}
				{canEdit && (
					<Button
						variant="contained"
						size="small"
						sx={{ mt: 1.5 }}
						onClick={save}
						disabled={!dirty || busy}
					>
						{busy ? "Saving…" : "Save"}
					</Button>
				)}
			</Paper>
		</Box>
	);
}
