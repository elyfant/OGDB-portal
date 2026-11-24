"use client";

import {
	addTankRun,
	deleteTankRun,
	saveTankRun,
	signOffTankRun,
} from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import {
	type CtReadingForm,
	type FieldDef,
	PITCH_GAIN_ACCEPTABLE,
	PITCH_GAIN_TYPICAL,
	type PitchPointForm,
	SECTIONS,
	TANK_WEIGHT_TOLERANCE_G,
	type TankRunForm,
	formFromRun,
	payloadFromForm,
	pitchGain,
	tankWeightDifference,
	volmaxCc,
} from "@/lib/tank-run";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import VerifiedIcon from "@mui/icons-material/Verified";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { TankRun } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

const GRID = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
	gap: 2,
} as const;

const fmt = (n: number | null, digits = 1) =>
	n === null ? "—" : n.toFixed(digits);

// The repeatable tank test / ballast runs of a refurbishment. Each run is a
// card the tech fills in over time; "Add another run" starts the next one.
// One run is marked final and signed off; only that run's trim values count.
export default function TankRunsSection({
	missionId,
	runs,
	canEdit,
}: {
	missionId: number;
	runs: TankRun[];
	canEdit: boolean;
}) {
	const router = useRouter();
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Expansion lives here, not in each card: a card remounts after every
	// save (so it re-reads what the server stored), which would otherwise
	// collapse it. The newest run starts open.
	const [expanded, setExpanded] = useState<Set<number>>(
		() => new Set(runs.length ? [runs[runs.length - 1].id] : []),
	);

	async function add() {
		setAdding(true);
		setError(null);
		try {
			const created = await addTankRun(missionId);
			setExpanded((e) => new Set(e).add(created.id));
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to add run.");
		} finally {
			setAdding(false);
		}
	}

	return (
		<Box>
			<Stack
				direction="row"
				sx={{ alignItems: "center", justifyContent: "flex-end", mb: 1 }}
			>
				{canEdit && (
					<Button
						size="small"
						variant="outlined"
						startIcon={<AddIcon fontSize="small" />}
						onClick={add}
						disabled={adding}
					>
						{adding ? "Adding…" : runs.length ? "Add another run" : "Add run"}
					</Button>
				)}
			</Stack>
			{error && (
				<Alert severity="error" sx={{ mb: 1 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			)}
			{runs.length === 0 && (
				<Typography color="text.secondary" variant="body2">
					No tank runs yet. All seagliders should be tank-tested to confirm
					ballasting and the CT sensor.
				</Typography>
			)}
			{runs.map((run) => (
				<TankRunCard
					key={`${run.id}-${run.updatedAt}`}
					missionId={missionId}
					run={run}
					canEdit={canEdit}
					expanded={expanded.has(run.id)}
					onToggle={(open) =>
						setExpanded((e) => {
							const next = new Set(e);
							if (open) next.add(run.id);
							else next.delete(run.id);
							return next;
						})
					}
				/>
			))}
		</Box>
	);
}

function TankRunCard({
	missionId,
	run,
	canEdit,
	expanded,
	onToggle,
}: {
	missionId: number;
	run: TankRun;
	canEdit: boolean;
	expanded: boolean;
	onToggle: (open: boolean) => void;
}) {
	const router = useRouter();
	const [form, setForm] = useState<TankRunForm>(() => formFromRun(run));
	const [saved, setSaved] = useState<TankRunForm>(form);
	const [busy, setBusy] = useState<"save" | "sign" | "delete" | null>(null);
	const [error, setError] = useState<string | null>(null);

	const dirty = JSON.stringify(form) !== JSON.stringify(saved);
	const signedOff = run.signedOffAt !== null;
	const readOnly = !canEdit || busy !== null;

	const gain = pitchGain(form.pitchPoints);
	const weightDiff = tankWeightDifference(form);
	const volmax = volmaxCc(form);

	const setField = (key: string, value: string) =>
		setForm((f) => ({ ...f, fields: { ...f.fields, [key]: value } }));

	async function run_<T>(
		kind: "save" | "sign" | "delete",
		fn: () => Promise<T>,
	) {
		setBusy(kind);
		setError(null);
		try {
			await fn();
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setBusy(null);
		}
	}

	const save = () =>
		run_("save", async () => {
			await saveTankRun(missionId, run.id, payloadFromForm(form));
			setSaved(form);
		});

	const signOff = () => run_("sign", () => signOffTankRun(missionId, run.id));

	const remove = () => {
		if (!window.confirm(`Delete run ${run.runNumber}? This can't be undone.`)) {
			return;
		}
		void run_("delete", () => deleteTankRun(missionId, run.id));
	};

	return (
		<Accordion
			expanded={expanded}
			onChange={(_, open) => onToggle(open)}
			disableGutters
			variant="outlined"
			sx={{ mb: 1 }}
		>
			<AccordionSummary expandIcon={<ExpandMoreIcon />}>
				<Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
					<Typography sx={{ fontWeight: 600 }}>Run {run.runNumber}</Typography>
					<Typography color="text.secondary" variant="body2">
						{formatDate(form.fields.runDate || run.createdAt)}
					</Typography>
					{form.isFinal && (
						<Chip size="small" label="Final run" color="primary" />
					)}
					{signedOff && (
						<Chip
							size="small"
							color="success"
							icon={<VerifiedIcon />}
							label={`Signed off${run.signedOffByName ? ` by ${run.signedOffByName}` : ""}`}
						/>
					)}
					{dirty && <Chip size="small" color="warning" label="Unsaved" />}
				</Stack>
			</AccordionSummary>
			<AccordionDetails>
				{signedOff && canEdit && (
					<Alert severity="info" sx={{ mb: 2 }}>
						This run is signed off. Saving any change withdraws the sign-off.
					</Alert>
				)}

				{SECTIONS.map((section) => (
					<Box key={section.title} sx={{ mb: 3 }}>
						<Typography variant="subtitle2" sx={{ mb: 0.5 }}>
							{section.title}
						</Typography>
						{section.hint && (
							<Typography
								variant="caption"
								color="text.secondary"
								display="block"
								sx={{ mb: 1 }}
							>
								{section.hint}
							</Typography>
						)}
						<Box sx={GRID}>
							{section.fields.map((f) => (
								<FieldInput
									key={f.key}
									def={f}
									value={form.fields[f.key]}
									onChange={(v) => setField(f.key, v)}
									disabled={readOnly}
								/>
							))}
						</Box>

						{section.title === "Pitch check" && (
							<PitchGainTable
								points={form.pitchPoints}
								onChange={(pitchPoints) =>
									setForm((f) => ({ ...f, pitchPoints }))
								}
								disabled={readOnly}
								gain={gain}
							/>
						)}
						{section.title === "Tank water" && (
							<CtReadings
								readings={form.ctReadings}
								onChange={(ctReadings) =>
									setForm((f) => ({ ...f, ctReadings }))
								}
								disabled={readOnly}
							/>
						)}
						{section.title === "Ballast" && weightDiff !== null && (
							<Alert
								severity={
									Math.abs(weightDiff) <= TANK_WEIGHT_TOLERANCE_G
										? "success"
										: "warning"
								}
								sx={{ mt: 1.5 }}
							>
								Measured is {weightDiff >= 0 ? "+" : ""}
								{fmt(weightDiff)} g from desired.{" "}
								{Math.abs(weightDiff) <= TANK_WEIGHT_TOLERANCE_G
									? `Within ±${TANK_WEIGHT_TOLERANCE_G} g.`
									: `Outside ±${TANK_WEIGHT_TOLERANCE_G} g: adjust the external ballast.`}
							</Alert>
						)}
						{section.title === "Final trim values" && (
							<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
								Calculated volmax: <strong>{fmt(volmax, 0)} cc</strong> (mass ÷
								tank density)
							</Typography>
						)}
					</Box>
				))}

				<FormControlLabel
					control={
						<Switch
							checked={form.isFinal}
							disabled={readOnly}
							onChange={(e) =>
								setForm((f) => ({ ...f, isFinal: e.target.checked }))
							}
						/>
					}
					label="This is the final run (its trim values are the ones used)"
				/>

				{error && (
					<Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>
						{error}
					</Alert>
				)}
				{run.updatedAt && (
					<Typography
						variant="caption"
						color="text.secondary"
						display="block"
						sx={{ mt: 1 }}
					>
						Last saved {formatDate(run.updatedAt)}
						{run.updatedByName ? ` by ${run.updatedByName}` : ""}
					</Typography>
				)}

				{canEdit && (
					<Stack direction="row" spacing={1} sx={{ mt: 2 }}>
						<Button
							variant="contained"
							size="small"
							onClick={save}
							disabled={!dirty || busy !== null}
						>
							{busy === "save" ? "Saving…" : "Save run"}
						</Button>
						<Button
							variant="outlined"
							size="small"
							color="success"
							onClick={signOff}
							disabled={!run.isFinal || dirty || signedOff || busy !== null}
							title={
								!run.isFinal
									? "Mark the run final and save first."
									: dirty
										? "Save your changes first."
										: undefined
							}
						>
							{busy === "sign" ? "Signing off…" : "Sign off final run"}
						</Button>
						<Box sx={{ flexGrow: 1 }} />
						<IconButton
							size="small"
							aria-label={`Delete run ${run.runNumber}`}
							onClick={remove}
							disabled={signedOff || busy !== null}
						>
							<DeleteOutlineIcon fontSize="small" />
						</IconButton>
					</Stack>
				)}
			</AccordionDetails>
		</Accordion>
	);
}

function FieldInput({
	def,
	value,
	onChange,
	disabled,
}: {
	def: FieldDef;
	value: string;
	onChange: (v: string) => void;
	disabled: boolean;
}) {
	const label = def.unit ? `${def.label} (${def.unit})` : def.label;
	if (def.kind === "bool") {
		return (
			<TextField
				select
				size="small"
				label={label}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				disabled={disabled}
				helperText={def.help}
			>
				<MenuItem value="">—</MenuItem>
				<MenuItem value="true">Yes</MenuItem>
				<MenuItem value="false">No</MenuItem>
			</TextField>
		);
	}
	return (
		<TextField
			size="small"
			label={label}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			disabled={disabled}
			helperText={def.help}
			type={def.kind === "date" ? "date" : "text"}
			multiline={def.kind === "text"}
			minRows={def.kind === "text" ? 2 : undefined}
			slotProps={{
				inputLabel: def.kind === "date" ? { shrink: true } : undefined,
				htmlInput:
					def.kind === "int"
						? { inputMode: "numeric" }
						: def.kind === "num"
							? { inputMode: "decimal" }
							: undefined,
			}}
			sx={def.kind === "text" ? { gridColumn: "1 / -1" } : undefined}
		/>
	);
}

function PitchGainTable({
	points,
	onChange,
	disabled,
	gain,
}: {
	points: PitchPointForm[];
	onChange: (p: PitchPointForm[]) => void;
	disabled: boolean;
	gain: ReturnType<typeof pitchGain>;
}) {
	const set = (i: number, patch: Partial<PitchPointForm>) =>
		onChange(points.map((p, j) => (j === i ? { ...p, ...patch } : p)));
	const inRange = (g: number, [lo, hi]: [number, number]) => {
		const a = Math.abs(g);
		return a >= lo && a <= hi;
	};
	return (
		<Box sx={{ mt: 2 }}>
			<Typography variant="body2" sx={{ fontWeight: 500 }}>
				Pitch gain
			</Typography>
			<Typography
				variant="caption"
				color="text.secondary"
				display="block"
				sx={{ mb: 1 }}
			>
				Move the pitch battery in ±0.5 cm steps and read the angle each time.
				Typical gain is {PITCH_GAIN_TYPICAL[0]}–{PITCH_GAIN_TYPICAL[1]} °/cm;{" "}
				{PITCH_GAIN_ACCEPTABLE[0]}–{PITCH_GAIN_ACCEPTABLE[1]} is acceptable.
			</Typography>
			<Stack spacing={1}>
				{points.map((p, i) => (
					<Stack
						// biome-ignore lint/suspicious/noArrayIndexKey: points have no id; order is their identity
						key={i}
						direction="row"
						spacing={1}
						sx={{ alignItems: "center" }}
					>
						<Typography variant="body2" sx={{ width: 56 }}>
							Pos {i + 1}
						</Typography>
						<TextField
							size="small"
							label="Position (cm)"
							value={p.pitchCm}
							onChange={(e) => set(i, { pitchCm: e.target.value })}
							disabled={disabled}
							slotProps={{ htmlInput: { inputMode: "decimal" } }}
						/>
						<TextField
							size="small"
							label="Angle (deg)"
							value={p.pitchDeg}
							onChange={(e) => set(i, { pitchDeg: e.target.value })}
							disabled={disabled}
							slotProps={{ htmlInput: { inputMode: "decimal" } }}
						/>
						<IconButton
							size="small"
							aria-label={`Remove position ${i + 1}`}
							onClick={() => onChange(points.filter((_, j) => j !== i))}
							disabled={disabled}
						>
							<DeleteOutlineIcon fontSize="small" />
						</IconButton>
					</Stack>
				))}
			</Stack>
			<Button
				size="small"
				sx={{ mt: 1 }}
				startIcon={<AddIcon fontSize="small" />}
				onClick={() => onChange([...points, { pitchCm: "", pitchDeg: "" }])}
				disabled={disabled || points.length >= 10}
			>
				Add position
			</Button>
			{gain.overall !== null && (
				<Alert
					severity={
						inRange(gain.overall, PITCH_GAIN_ACCEPTABLE) ? "success" : "warning"
					}
					sx={{ mt: 1 }}
				>
					Pitch gain {fmt(gain.overall)} °/cm
					{gain.pairs.length > 1 &&
						` (between neighbours: ${gain.pairs.map((g) => fmt(g.gain)).join(", ")})`}
					{inRange(gain.overall, PITCH_GAIN_ACCEPTABLE)
						? "."
						: `. Outside ${PITCH_GAIN_ACCEPTABLE[0]}–${PITCH_GAIN_ACCEPTABLE[1]}.`}
				</Alert>
			)}
		</Box>
	);
}

function CtReadings({
	readings,
	onChange,
	disabled,
}: {
	readings: CtReadingForm[];
	onChange: (r: CtReadingForm[]) => void;
	disabled: boolean;
}) {
	const set = (i: number, patch: Partial<CtReadingForm>) =>
		onChange(readings.map((r, j) => (j === i ? { ...r, ...patch } : r)));
	return (
		<Box sx={{ mt: 2 }}>
			<Typography variant="body2" sx={{ fontWeight: 500 }}>
				CT readings
			</Typography>
			<Typography
				variant="caption"
				color="text.secondary"
				display="block"
				sx={{ mb: 1 }}
			>
				One row per fitted CT sensor. Compare with the reference sensor: tank
				temperature is typically about 10 °C and salinity about 34.5.
			</Typography>
			<Stack spacing={1}>
				{readings.map((r, i) => (
					<Stack
						// biome-ignore lint/suspicious/noArrayIndexKey: readings have no id until saved
						key={i}
						direction="row"
						spacing={1}
						sx={{ alignItems: "center" }}
					>
						<TextField
							size="small"
							label="Sensor"
							value={r.sensorLabel}
							onChange={(e) => set(i, { sensorLabel: e.target.value })}
							disabled={disabled}
							placeholder="e.g. CT sail, RBR Legato"
						/>
						<TextField
							size="small"
							label="Temp (°C)"
							value={r.tempC}
							onChange={(e) => set(i, { tempC: e.target.value })}
							disabled={disabled}
							slotProps={{ htmlInput: { inputMode: "decimal" } }}
						/>
						<TextField
							size="small"
							label="Salinity (PSU)"
							value={r.salinityPsu}
							onChange={(e) => set(i, { salinityPsu: e.target.value })}
							disabled={disabled}
							slotProps={{ htmlInput: { inputMode: "decimal" } }}
						/>
						<IconButton
							size="small"
							aria-label={`Remove CT reading ${i + 1}`}
							onClick={() => onChange(readings.filter((_, j) => j !== i))}
							disabled={disabled}
						>
							<DeleteOutlineIcon fontSize="small" />
						</IconButton>
					</Stack>
				))}
			</Stack>
			<Button
				size="small"
				sx={{ mt: 1 }}
				startIcon={<AddIcon fontSize="small" />}
				onClick={() =>
					onChange([
						...readings,
						{ sensorLabel: "", tempC: "", salinityPsu: "" },
					])
				}
				disabled={disabled || readings.length >= 10}
			>
				Add CT sensor
			</Button>
		</Box>
	);
}
