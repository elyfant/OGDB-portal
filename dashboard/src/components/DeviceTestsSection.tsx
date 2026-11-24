"use client";

import { saveDeviceTests } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { RefurbDeviceTest, RefurbDeviceTests } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Result = "pass" | "fail" | null;
interface RowState {
	result: Result;
	note: string;
}

// Section 7 of the refurbishment logsheet. Lists only the devices this glider
// has: the built-in four plus each science sensor in the mission's build, so
// a sensor that was swapped in the Batteries/build step shows up here by
// itself. A fail must say what was wrong.
export default function DeviceTestsSection({
	missionId,
	data,
	canEdit,
}: {
	missionId: number;
	data: RefurbDeviceTests;
	canEdit: boolean;
}) {
	const router = useRouter();
	const initial: Record<string, RowState> = Object.fromEntries(
		data.devices.map((d) => [d.key, { result: d.result, note: d.note ?? "" }]),
	);
	const [rows, setRows] = useState(initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const changed = data.devices.filter(
		(d) =>
			rows[d.key].result !== initial[d.key].result ||
			rows[d.key].note !== initial[d.key].note,
	);
	const missingNote = changed.filter(
		(d) => rows[d.key].result === "fail" && rows[d.key].note.trim() === "",
	);
	const disabled = !canEdit || busy;
	const passed = data.devices.filter(
		(d) => rows[d.key].result === "pass",
	).length;

	const set = (key: string, patch: Partial<RowState>) =>
		setRows((r) => ({ ...r, [key]: { ...r[key], ...patch } }));

	async function save() {
		setBusy(true);
		setError(null);
		try {
			await saveDeviceTests(
				missionId,
				changed.map((d) => ({
					key: d.key,
					result: rows[d.key].result,
					note: rows[d.key].note.trim() || null,
				})),
			);
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Box>
			<Stack
				direction="row"
				spacing={1.5}
				sx={{ alignItems: "center", mb: 0.5 }}
			>
				<Chip
					size="small"
					color={passed === data.devices.length ? "success" : "default"}
					label={`${passed} of ${data.devices.length} passed`}
				/>
			</Stack>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
				Test each device individually and confirm it is connected and configured
				correctly. Take particular care with anything newly installed.
			</Typography>

			<Stack spacing={1}>
				{data.devices.map((d) => (
					<DeviceRow
						key={d.key}
						device={d}
						state={rows[d.key]}
						onChange={(patch) => set(d.key, patch)}
						disabled={disabled}
						dirty={changed.includes(d)}
					/>
				))}
			</Stack>

			{missingNote.length > 0 && (
				<Alert severity="warning" sx={{ mt: 1.5 }}>
					Say what failed for: {missingNote.map((d) => d.label).join(", ")}.
				</Alert>
			)}
			{error && (
				<Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			)}
			{canEdit && (
				<Button
					variant="contained"
					size="small"
					sx={{ mt: 1.5 }}
					onClick={save}
					disabled={changed.length === 0 || missingNote.length > 0 || busy}
				>
					{busy
						? "Saving…"
						: changed.length > 0
							? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}`
							: "Save"}
				</Button>
			)}
		</Box>
	);
}

function DeviceRow({
	device,
	state,
	onChange,
	disabled,
	dirty,
}: {
	device: RefurbDeviceTest;
	state: RowState;
	onChange: (patch: Partial<RowState>) => void;
	disabled: boolean;
	dirty: boolean;
}) {
	return (
		<Paper
			variant="outlined"
			sx={{
				p: 1.5,
				display: "grid",
				gridTemplateColumns: { xs: "1fr", md: "minmax(180px, 1fr) auto 2fr" },
				gap: 1.5,
				alignItems: "start",
			}}
		>
			<Box>
				<Typography sx={{ fontWeight: 600 }}>{device.label}</Typography>
				{device.detail && (
					<Typography variant="body2" color="text.secondary">
						{device.detail}
					</Typography>
				)}
				{device.hint && (
					<Typography variant="caption" color="text.secondary" display="block">
						{device.hint}
					</Typography>
				)}
				{device.updatedAt && !dirty && (
					<Typography variant="caption" color="text.secondary" display="block">
						{formatDate(device.updatedAt)}
						{device.updatedByName ? ` · ${device.updatedByName}` : ""}
					</Typography>
				)}
			</Box>
			<ToggleButtonGroup
				exclusive
				size="small"
				value={state.result}
				disabled={disabled}
				onChange={(_, value: Result | undefined) =>
					// Clicking the active button again clears it (back to untested).
					onChange({ result: value ?? null })
				}
				aria-label={`${device.label} result`}
			>
				<ToggleButton value="pass" color="success">
					Pass
				</ToggleButton>
				<ToggleButton value="fail" color="error">
					Fail
				</ToggleButton>
			</ToggleButtonGroup>
			<TextField
				size="small"
				label={state.result === "fail" ? "What failed (required)" : "Notes"}
				value={state.note}
				onChange={(e) => onChange({ note: e.target.value })}
				disabled={disabled}
				error={state.result === "fail" && state.note.trim() === ""}
				multiline
				minRows={1}
			/>
		</Paper>
	);
}
