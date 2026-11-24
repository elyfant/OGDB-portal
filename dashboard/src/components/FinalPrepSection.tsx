"use client";

import {
	deleteTagScreenshot,
	saveRefurbFinalPrep,
	uploadTagScreenshots,
} from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { RefurbFinalPrep } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

// The tag's own limits from the procedure, and the pulled-hull target.
const TAG_BATTERY_V = [3.3, 3.7] as const;
const TX_WARN = 30000;
const TX_LIMIT = 40000;
const TARGET_PSIA = 9;
const TOLERANCE_PSIA = 0.2;

const PACKING = [
	["packTagClamps", "Argos tag with clamps, screws and Allen key"],
	["packCommsCable", "Communication cable and USB converter"],
	["packShortingOrWand", "Magnetic wand (Rev B) / shorting cable (Rev E)"],
	["packWings", "Wings"],
	["packRudder", "Rudder"],
	["packCradle", "Cradle"],
	["packSpareKit", "Spare kit (screws, tools, sensor caps)"],
	["packReleaseMechanism", "Deployment release mechanism"],
	["packPc", "PC with Tera Term"],
] as const;

type BoolKey =
	| "travelModeSet"
	| "gliderOff"
	| "tagTimeSynced"
	| "tagConfigConfirmed"
	| "tagTestOk"
	| "tagAutoStart"
	| (typeof PACKING)[number][0];

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const numOrNull = (s: string) =>
	s.trim() === "" ? null : Number(s.replace(",", "."));

function initialForm(d: RefurbFinalPrep) {
	return {
		pressureFinalPsia: str(d.pressureFinalPsia),
		argosAssetId: d.argosAssetId === null ? "" : String(d.argosAssetId),
		pttId: str(d.pttId),
		tagBatteryV: str(d.tagBatteryV),
		tagTransmissions: str(d.tagTransmissions),
		notes: str(d.notes),
		travelModeSet: d.travelModeSet,
		gliderOff: d.gliderOff,
		tagTimeSynced: d.tagTimeSynced,
		tagConfigConfirmed: d.tagConfigConfirmed,
		tagTestOk: d.tagTestOk,
		tagAutoStart: d.tagAutoStart,
		packTagClamps: d.packTagClamps,
		packCommsCable: d.packCommsCable,
		packShortingOrWand: d.packShortingOrWand,
		packWings: d.packWings,
		packRudder: d.packRudder,
		packCradle: d.packCradle,
		packSpareKit: d.packSpareKit,
		packReleaseMechanism: d.packReleaseMechanism,
		packPc: d.packPc,
	};
}

// Section J of the refurbishment logsheet: the last things done before the
// glider leaves the workshop. Choosing a different Argos tag also changes the
// mission's build. The tag test screenshot is attached to the mission, so it
// is reachable from there afterwards.
export default function FinalPrepSection({
	missionId,
	data,
	canEdit,
}: {
	missionId: number;
	data: RefurbFinalPrep;
	canEdit: boolean;
}) {
	const router = useRouter();
	const initial = initialForm(data);
	const [form, setForm] = useState(initial);
	const [busy, setBusy] = useState<"save" | "upload" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);

	const dirty = JSON.stringify(form) !== JSON.stringify(initial);
	const disabled = !canEdit || busy !== null;
	const set = (patch: Partial<typeof form>) =>
		setForm((f) => ({ ...f, ...patch }));

	const pressure = numOrNull(form.pressureFinalPsia);
	const pressureOff =
		pressure !== null && Math.abs(pressure - TARGET_PSIA) > TOLERANCE_PSIA;
	const volts = numOrNull(form.tagBatteryV);
	const voltsOff =
		volts !== null && (volts < TAG_BATTERY_V[0] || volts > TAG_BATTERY_V[1]);
	const tx = numOrNull(form.tagTransmissions);
	const packed = PACKING.filter(([key]) => form[key]).length;

	async function run(kind: "save" | "upload", fn: () => Promise<unknown>) {
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
		run("save", () =>
			saveRefurbFinalPrep(missionId, {
				pressureFinalPsia: pressure,
				travelModeSet: form.travelModeSet,
				gliderOff: form.gliderOff,
				argosAssetId:
					form.argosAssetId === "" ? null : Number(form.argosAssetId),
				pttId: form.pttId.trim() || null,
				tagTimeSynced: form.tagTimeSynced,
				tagConfigConfirmed: form.tagConfigConfirmed,
				tagTestOk: form.tagTestOk,
				tagBatteryV: volts,
				tagTransmissions: tx,
				tagAutoStart: form.tagAutoStart,
				packTagClamps: form.packTagClamps,
				packCommsCable: form.packCommsCable,
				packShortingOrWand: form.packShortingOrWand,
				packWings: form.packWings,
				packRudder: form.packRudder,
				packCradle: form.packCradle,
				packSpareKit: form.packSpareKit,
				packReleaseMechanism: form.packReleaseMechanism,
				packPc: form.packPc,
				notes: form.notes.trim() || null,
			}),
		);

	const box = (key: BoolKey, label: string, hint?: string) => (
		<Box key={key}>
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

	return (
		<Box>
			<Stack spacing={2}>
				<Paper variant="outlined" sx={{ p: 2 }}>
					<Typography variant="subtitle2" sx={{ mb: 1 }}>
						Before packing
					</Typography>
					<TextField
						size="small"
						label="Internal pressure (psia)"
						value={form.pressureFinalPsia}
						onChange={(e) => set({ pressureFinalPsia: e.target.value })}
						disabled={disabled}
						helperText={`Check again before shipping. Target ${TARGET_PSIA} ± ${TOLERANCE_PSIA} psia.`}
						slotProps={{ htmlInput: { inputMode: "decimal" } }}
						sx={{ mb: 1, minWidth: 260 }}
					/>
					{pressureOff && (
						<Alert severity="warning" sx={{ mb: 1 }}>
							Outside {TARGET_PSIA} ± {TOLERANCE_PSIA} psia. Say why in the
							notes if it is accepted.
						</Alert>
					)}
					<Stack>
						{box(
							"travelModeSet",
							"Glider set in travel mode",
							"Main menu → hardware tests and monitoring → miscellaneous → travel. After bleeding, the oil pump and motors are parked.",
						)}
						{box("gliderOff", "Glider turned off")}
					</Stack>
				</Paper>

				<Paper variant="outlined" sx={{ p: 2 }}>
					<Typography variant="subtitle2" sx={{ mb: 1 }}>
						Argos tag for this mission
					</Typography>
					<Box
						sx={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
							gap: 2,
							mb: 1,
						}}
					>
						<TextField
							select
							size="small"
							label="Tag (serial)"
							value={form.argosAssetId}
							onChange={(e) => set({ argosAssetId: e.target.value })}
							disabled={disabled}
						>
							<MenuItem value="">—</MenuItem>
							{data.tagCandidates.map((t) => (
								<MenuItem key={t.id} value={String(t.id)}>
									{t.serialNumber ?? `#${t.id}`}
								</MenuItem>
							))}
						</TextField>
						<TextField
							size="small"
							label="PTT ID"
							value={form.pttId}
							onChange={(e) => set({ pttId: e.target.value })}
							disabled={disabled}
						/>
						<TextField
							size="small"
							label="Tag battery (V)"
							value={form.tagBatteryV}
							onChange={(e) => set({ tagBatteryV: e.target.value })}
							disabled={disabled}
							error={voltsOff}
							helperText={`Should be ${TAG_BATTERY_V[0]}–${TAG_BATTERY_V[1]} V.`}
							slotProps={{ htmlInput: { inputMode: "decimal" } }}
						/>
						<TextField
							size="small"
							label="Transmissions so far"
							value={form.tagTransmissions}
							onChange={(e) => set({ tagTransmissions: e.target.value })}
							disabled={disabled}
							error={tx !== null && tx > TX_LIMIT}
							helperText={`Should be below ${TX_WARN.toLocaleString("en")}–${TX_LIMIT.toLocaleString("en")}.`}
							slotProps={{ htmlInput: { inputMode: "numeric" } }}
						/>
					</Box>
					{data.tagCandidates.length > 0 &&
						form.argosAssetId !== "" &&
						Number(form.argosAssetId) !== data.argosAssetId && (
							<Typography
								variant="caption"
								color="text.secondary"
								display="block"
							>
								Saving also changes this mission's build.
							</Typography>
						)}
					{voltsOff && (
						<Alert severity="warning" sx={{ mt: 1 }}>
							Tag battery is outside {TAG_BATTERY_V[0]}–{TAG_BATTERY_V[1]} V.
						</Alert>
					)}
					{tx !== null && tx > TX_WARN && (
						<Alert
							severity={tx > TX_LIMIT ? "error" : "warning"}
							sx={{ mt: 1 }}
						>
							{tx > TX_LIMIT
								? `Over ${TX_LIMIT.toLocaleString("en")} transmissions: the tag is past its limit.`
								: `Over ${TX_WARN.toLocaleString("en")} transmissions: check the tag is good for another mission.`}
						</Alert>
					)}
					<Stack sx={{ mt: 1 }}>
						{box(
							"tagTimeSynced",
							"Connected to the PC, activated by the magnetic switch, time synced",
						)}
						{box("tagConfigConfirmed", "Configuration confirmed")}
						{box("tagTestOk", "Test transmission run and OK")}
						{box(
							"tagAutoStart",
							"Set to auto-start mode",
							"It turns on when the glider is deployed (on contact with water).",
						)}
					</Stack>

					<Typography variant="body2" sx={{ fontWeight: 600, mt: 1.5 }}>
						Test transmission screenshot
					</Typography>
					{data.screenshots.length === 0 ? (
						<Typography variant="body2" color="text.secondary">
							None uploaded yet.
						</Typography>
					) : (
						<Stack sx={{ mt: 0.5 }}>
							{data.screenshots.map((s) => (
								<Stack
									key={s.id}
									direction="row"
									spacing={1}
									sx={{ alignItems: "center" }}
								>
									<MuiLink
										href={`/api/documents/${s.id}/file`}
										target="_blank"
										rel="noreferrer"
									>
										{s.fileName}
									</MuiLink>
									<Typography variant="caption" color="text.secondary">
										{formatDate(s.uploadedAt)}
									</Typography>
									{canEdit && (
										<IconButton
											size="small"
											aria-label={`Remove ${s.fileName}`}
											disabled={disabled}
											onClick={() =>
												run("upload", () =>
													deleteTagScreenshot(missionId, s.id),
												)
											}
										>
											<DeleteOutlineIcon fontSize="small" />
										</IconButton>
									)}
								</Stack>
							))}
						</Stack>
					)}
					{canEdit && (
						<>
							<input
								ref={fileInput}
								type="file"
								hidden
								multiple
								accept="image/*,.pdf"
								onChange={(e) => {
									const files = Array.from(e.target.files ?? []);
									e.target.value = "";
									if (files.length > 0) {
										void run("upload", () =>
											uploadTagScreenshots(missionId, files),
										);
									}
								}}
							/>
							<Button
								size="small"
								sx={{ mt: 1 }}
								startIcon={<UploadFileIcon fontSize="small" />}
								onClick={() => fileInput.current?.click()}
								disabled={disabled}
							>
								{busy === "upload" ? "Uploading…" : "Upload screenshot"}
							</Button>
						</>
					)}
				</Paper>

				<Paper variant="outlined" sx={{ p: 2 }}>
					<Typography variant="subtitle2">
						Packing ({packed} of {PACKING.length})
					</Typography>
					<Stack>{PACKING.map(([key, label]) => box(key, label))}</Stack>
				</Paper>

				<TextField
					size="small"
					fullWidth
					multiline
					minRows={2}
					label="Notes"
					value={form.notes}
					onChange={(e) => set({ notes: e.target.value })}
					disabled={disabled}
				/>
			</Stack>

			{error && (
				<Alert severity="error" sx={{ mt: 1.5 }} onClose={() => setError(null)}>
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
					disabled={!dirty || busy !== null}
				>
					{busy === "save" ? "Saving…" : "Save"}
				</Button>
			)}
		</Box>
	);
}
