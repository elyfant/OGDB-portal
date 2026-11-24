"use client";

import { saveSensorChecks, swapRefurbSensor } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type {
	RefurbSensor,
	RefurbSensorCandidate,
	RefurbSensors,
} from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface RowState {
	reviewed: boolean;
	coefficientsOk: boolean;
	zeroFrequencyOk: boolean;
	needsCalibration: boolean;
	notes: string;
}

const rowOf = (s: RefurbSensor): RowState => ({
	reviewed: s.reviewed,
	coefficientsOk: s.coefficientsOk,
	zeroFrequencyOk: s.zeroFrequencyOk,
	needsCalibration: s.needsCalibration,
	notes: s.notes ?? "",
});

const SENSOR_GROUPS: Record<string, string> = {
	ct_sensor: "CT sensors",
	do_sensor: "Oxygen optodes",
	eco_sensor: "ECO sensors",
	mr_sensor: "MicroRiders",
};

const name = (s: RefurbSensor) =>
	`${s.typeLabel}${s.serialNumber ? ` ${s.serialNumber}` : ""}`;

// Section 4 of the refurbishment logsheet. The fitted sensors come from the
// mission build, so the list cannot disagree with it, and putting a different
// sensor in here changes the build too. Calibration is not re-implemented: the
// latest one on record is shown, and "Needs calibration" is the old sheet's
// "Cal required?".
export default function SensorsSection({
	missionId,
	data,
	canEdit,
}: {
	missionId: number;
	data: RefurbSensors;
	canEdit: boolean;
}) {
	const router = useRouter();
	const initial: Record<number, RowState> = Object.fromEntries(
		data.sensors.map((s) => [s.assetId, rowOf(s)]),
	);
	const [rows, setRows] = useState(initial);
	// Which sensor is being replaced ("new" = adding one to an empty slot).
	const [swapping, setSwapping] = useState<number | "new" | null>(null);
	const [choice, setChoice] = useState<RefurbSensorCandidate | null>(null);
	const [busy, setBusy] = useState<"save" | "swap" | null>(null);
	const [error, setError] = useState<string | null>(null);

	const changed = data.sensors.filter(
		(s) =>
			JSON.stringify(rows[s.assetId]) !== JSON.stringify(initial[s.assetId]),
	);
	const disabled = !canEdit || busy !== null;
	const checkedCount = data.sensors.filter(
		(s) => rows[s.assetId].reviewed,
	).length;

	const set = (id: number, patch: Partial<RowState>) =>
		setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

	async function run(kind: "save" | "swap", fn: () => Promise<unknown>) {
		setBusy(kind);
		setError(null);
		try {
			await fn();
			setSwapping(null);
			setChoice(null);
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setBusy(null);
		}
	}

	const save = () =>
		run("save", () =>
			saveSensorChecks(
				missionId,
				changed.map((s) => ({
					assetId: s.assetId,
					...rows[s.assetId],
					notes: rows[s.assetId].notes.trim() || null,
				})),
			),
		);

	const swapPicker = (oldAssetId: number | null) => (
		<Box sx={{ mt: 1.5 }}>
			<Autocomplete
				size="small"
				options={data.candidates}
				value={choice}
				onChange={(_, c) => setChoice(c)}
				getOptionLabel={(c) => c.label}
				groupBy={(c) => SENSOR_GROUPS[c.assetType] ?? "Other sensors"}
				isOptionEqualToValue={(a, b) => a.id === b.id}
				disabled={disabled}
				renderInput={(params) => (
					<TextField {...params} label="Sensor to put in (type and serial)" />
				)}
			/>
			<Typography
				variant="caption"
				color="text.secondary"
				display="block"
				sx={{ mt: 0.5 }}
			>
				This changes this mission's build. Any sensor type can replace any
				other, e.g. an ECO swapped for a different instrument in the same port.
			</Typography>
			<Stack direction="row" spacing={1} sx={{ mt: 1 }}>
				<Button
					size="small"
					variant="contained"
					disabled={disabled || !choice}
					onClick={() =>
						choice &&
						run("swap", () =>
							swapRefurbSensor(missionId, oldAssetId, choice.id),
						)
					}
				>
					{busy === "swap"
						? "Saving…"
						: oldAssetId === null
							? "Add sensor"
							: "Replace sensor"}
				</Button>
				<Button
					size="small"
					disabled={busy !== null}
					onClick={() => {
						setSwapping(null);
						setChoice(null);
					}}
				>
					Cancel
				</Button>
			</Stack>
		</Box>
	);

	return (
		<Box>
			<Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
				<Chip
					size="small"
					color={
						checkedCount === data.sensors.length && data.sensors.length > 0
							? "success"
							: "default"
					}
					label={`${checkedCount} of ${data.sensors.length} checked`}
				/>
			</Stack>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
				The sensors fitted for this mission. Check each one's calibration, and
				replace it here if it was swapped.
			</Typography>

			{data.sensors.length === 0 && (
				<Alert severity="warning" sx={{ mb: 1.5 }}>
					This mission's build has no sensors yet. Add one below.
				</Alert>
			)}

			<Stack spacing={1.5}>
				{data.sensors.map((s) => {
					const row = rows[s.assetId];
					return (
						<Paper key={s.assetId} variant="outlined" sx={{ p: 2 }}>
							<Stack
								direction="row"
								spacing={1}
								sx={{ alignItems: "center", flexWrap: "wrap", mb: 0.5 }}
							>
								<Typography sx={{ fontWeight: 600 }}>{name(s)}</Typography>
								{s.model && (
									<Typography variant="body2" color="text.secondary">
										{s.model}
									</Typography>
								)}
								{s.position && (
									<Typography variant="caption" color="text.secondary">
										· {s.position}
									</Typography>
								)}
								{s.replaced && (
									<Chip
										size="small"
										color="info"
										label={
											s.replacedLabel
												? `Replaced ${s.replacedLabel}`
												: "Added in this refurbishment"
										}
									/>
								)}
							</Stack>
							<Typography variant="body2" color="text.secondary">
								{s.calibrationDate
									? `Latest calibration ${formatDate(s.calibrationDate)}`
									: "No calibration on record"}
								{" · "}
								<MuiLink href={`/assets/${s.assetId}`}>Open sensor</MuiLink>
							</Typography>

							<Stack sx={{ mt: 1 }}>
								<FormControlLabel
									control={
										<Checkbox
											checked={row.reviewed}
											disabled={disabled}
											onChange={(e) =>
												set(s.assetId, { reviewed: e.target.checked })
											}
										/>
									}
									label="Checked: calibration and condition reviewed"
								/>
								{s.replaced && (
									<FormControlLabel
										control={
											<Checkbox
												checked={row.coefficientsOk}
												disabled={disabled}
												onChange={(e) =>
													set(s.assetId, { coefficientsOk: e.target.checked })
												}
											/>
										}
										label="Calibration coefficients entered on the glider and in sg_calib_constants.m"
									/>
								)}
								{s.requiresZeroFrequency && (
									<FormControlLabel
										control={
											<Checkbox
												checked={row.zeroFrequencyOk}
												disabled={disabled}
												onChange={(e) =>
													set(s.assetId, { zeroFrequencyOk: e.target.checked })
												}
											/>
										}
										label="CT sail: zero conductivity frequency checked"
									/>
								)}
								<FormControlLabel
									control={
										<Checkbox
											checked={row.needsCalibration}
											disabled={disabled}
											onChange={(e) =>
												set(s.assetId, { needsCalibration: e.target.checked })
											}
										/>
									}
									label="Needs calibration before it can fly"
								/>
							</Stack>
							<TextField
								size="small"
								fullWidth
								multiline
								minRows={1}
								label="Notes"
								value={row.notes}
								onChange={(e) => set(s.assetId, { notes: e.target.value })}
								disabled={disabled}
								sx={{ mt: 1 }}
							/>
							{s.updatedAt && (
								<Typography
									variant="caption"
									color="text.secondary"
									display="block"
									sx={{ mt: 0.5 }}
								>
									Last saved {formatDate(s.updatedAt)}
									{s.updatedByName ? ` by ${s.updatedByName}` : ""}
								</Typography>
							)}
							{canEdit &&
								(swapping === s.assetId ? (
									swapPicker(s.assetId)
								) : (
									<Button
										size="small"
										sx={{ mt: 1 }}
										disabled={disabled}
										onClick={() => {
											setSwapping(s.assetId);
											setChoice(null);
										}}
									>
										Replace this sensor…
									</Button>
								))}
						</Paper>
					);
				})}
			</Stack>

			{canEdit && (
				<Box sx={{ mt: 1.5 }}>
					{swapping === "new" ? (
						swapPicker(null)
					) : (
						<Button
							size="small"
							variant="outlined"
							disabled={disabled}
							onClick={() => {
								setSwapping("new");
								setChoice(null);
							}}
						>
							Add a sensor…
						</Button>
					)}
				</Box>
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
					disabled={changed.length === 0 || busy !== null}
				>
					{busy === "save"
						? "Saving…"
						: changed.length > 0
							? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}`
							: "Save"}
				</Button>
			)}
		</Box>
	);
}
