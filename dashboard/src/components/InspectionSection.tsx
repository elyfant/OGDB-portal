"use client";

import { saveRefurbInspection } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import type { RefurbInspection, RefurbInspectionItem } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Status = RefurbInspectionItem["status"];
interface RowState {
	status: Status;
	note: string;
}

const needsNote = (s: Status) => s === "issue" || s === "repaired";

// Sections 2b and 3 of the refurbishment logsheet. The checklist itself is
// fixed (it is the logsheet's own); the tech marks each line OK, needs work
// or repaired. Needs work and repaired must say what and where. A line left
// at "needs work" keeps the glider from being cleared to deploy.
export default function InspectionSection({
	missionId,
	data,
	canEdit,
}: {
	missionId: number;
	data: RefurbInspection;
	canEdit: boolean;
}) {
	const router = useRouter();
	const initial: Record<string, RowState> = Object.fromEntries(
		data.items.map((i) => [i.key, { status: i.status, note: i.note ?? "" }]),
	);
	const [rows, setRows] = useState(initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const changed = data.items.filter(
		(i) =>
			rows[i.key].status !== initial[i.key].status ||
			rows[i.key].note !== initial[i.key].note,
	);
	const missingNote = changed.filter(
		(i) => needsNote(rows[i.key].status) && rows[i.key].note.trim() === "",
	);
	const disabled = !canEdit || busy;
	const done = data.items.filter((i) => rows[i.key].status !== null).length;
	const stillOpen = data.items.filter((i) => rows[i.key].status === "issue");

	const set = (key: string, patch: Partial<RowState>) =>
		setRows((r) => ({ ...r, [key]: { ...r[key], ...patch } }));

	async function save() {
		setBusy(true);
		setError(null);
		try {
			await saveRefurbInspection(
				missionId,
				changed.map((i) => ({
					key: i.key,
					status: rows[i.key].status,
					note: rows[i.key].note.trim() || null,
				})),
			);
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save.");
		} finally {
			setBusy(false);
		}
	}

	const group = (
		phase: RefurbInspectionItem["phase"],
		title: string,
		intro: string,
	) => (
		<Box sx={{ mb: 2.5 }}>
			<Typography variant="subtitle2">{title}</Typography>
			<Typography
				variant="caption"
				color="text.secondary"
				display="block"
				sx={{ mb: 1 }}
			>
				{intro}
			</Typography>
			<Stack spacing={1}>
				{data.items
					.filter((i) => i.phase === phase)
					.map((i) => (
						<ItemRow
							key={i.key}
							item={i}
							state={rows[i.key]}
							onChange={(patch) => set(i.key, patch)}
							disabled={disabled}
							dirty={changed.includes(i)}
						/>
					))}
			</Stack>
		</Box>
	);

	return (
		<Box>
			<Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
				<Chip
					size="small"
					color={
						done === data.items.length && stillOpen.length === 0
							? "success"
							: "default"
					}
					label={`${done} of ${data.items.length} done`}
				/>
				{stillOpen.length > 0 && (
					<Chip
						size="small"
						color="warning"
						label={`${stillOpen.length} needs work`}
					/>
				)}
			</Stack>

			{group(
				"external",
				"External inspection",
				"Before opening the glider. Note the condition and any repairs performed or needed.",
			)}
			{group(
				"internal",
				"Open glider and internal inspection",
				"Release the vacuum and set the pitch battery aft before opening.",
			)}

			{missingNote.length > 0 && (
				<Alert severity="warning" sx={{ mb: 1.5 }}>
					Say what and where for: {missingNote.map((i) => i.label).join(", ")}.
				</Alert>
			)}
			{error && (
				<Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			)}
			{canEdit && (
				<Button
					variant="contained"
					size="small"
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

function ItemRow({
	item,
	state,
	onChange,
	disabled,
	dirty,
}: {
	item: RefurbInspectionItem;
	state: RowState;
	onChange: (patch: Partial<RowState>) => void;
	disabled: boolean;
	dirty: boolean;
}) {
	const meta = (
		<>
			{item.hint && (
				<Typography variant="caption" color="text.secondary" display="block">
					{item.hint}
				</Typography>
			)}
			{item.updatedAt && !dirty && (
				<Typography variant="caption" color="text.secondary" display="block">
					{formatDate(item.updatedAt)}
					{item.updatedByName ? ` · ${item.updatedByName}` : ""}
				</Typography>
			)}
		</>
	);

	// A step is just done or not done.
	if (item.kind === "step") {
		return (
			<Paper variant="outlined" sx={{ p: 1.5 }}>
				<FormControlLabel
					control={
						<Checkbox
							checked={state.status === "done"}
							disabled={disabled}
							onChange={(e) =>
								onChange({ status: e.target.checked ? "done" : null })
							}
						/>
					}
					label={item.label}
				/>
				<Box sx={{ ml: 4 }}>{meta}</Box>
			</Paper>
		);
	}

	return (
		<Paper
			variant="outlined"
			sx={{
				p: 1.5,
				display: "grid",
				gridTemplateColumns: { xs: "1fr", md: "minmax(200px, 1fr) auto 2fr" },
				gap: 1.5,
				alignItems: "start",
			}}
		>
			<Box>
				<Typography sx={{ fontWeight: 600 }}>{item.label}</Typography>
				{meta}
			</Box>
			<ToggleButtonGroup
				exclusive
				size="small"
				value={state.status}
				disabled={disabled}
				onChange={(_, value: Status | undefined) =>
					// Clicking the active button again clears it (back to not done).
					onChange({ status: value ?? null })
				}
				aria-label={`${item.label} condition`}
			>
				<ToggleButton value="ok" color="success">
					OK
				</ToggleButton>
				<ToggleButton value="issue" color="warning">
					Needs work
				</ToggleButton>
				<ToggleButton value="repaired" color="info">
					Repaired
				</ToggleButton>
			</ToggleButtonGroup>
			<TextField
				size="small"
				label={needsNote(state.status) ? "What and where (required)" : "Notes"}
				value={state.note}
				onChange={(e) => onChange({ note: e.target.value })}
				disabled={disabled}
				error={needsNote(state.status) && state.note.trim() === ""}
				multiline
				minRows={1}
			/>
		</Paper>
	);
}
