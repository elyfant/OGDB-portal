"use client";

import ArgosTagFields from "@/components/ArgosTagFields";
import { saveRefurbFinalPrep } from "@/lib/api-client";
import { emptyTestForm, testFormFrom, testPayload } from "@/lib/argos-tag";
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
import type { RefurbFinalPrep } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

// The pulled-hull target. (The tag's own limits live with the tag fields.)
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
	| "tagAutoStart"
	| (typeof PACKING)[number][0];

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const numOrNull = (s: string) =>
	s.trim() === "" ? null : Number(s.replace(",", "."));

function initialForm(d: RefurbFinalPrep) {
	return {
		pressureFinalPsia: str(d.pressureFinalPsia),
		argosAssetId: d.argosAssetId === null ? "" : String(d.argosAssetId),
		// The readings from this test of the tag (added to the tag's history).
		test: testFormFrom(d.tagTest),
		notes: str(d.notes),
		travelModeSet: d.travelModeSet,
		gliderOff: d.gliderOff,
		tagTimeSynced: d.tagTimeSynced,
		tagConfigConfirmed: d.tagConfigConfirmed,
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
// mission's build. The tag's details and test readings are typed in here and
// kept on the tag itself, so they are there for every mission it flies on.
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
	const [busy, setBusy] = useState<"save" | null>(null);
	const [error, setError] = useState<string | null>(null);

	const dirty = JSON.stringify(form) !== JSON.stringify(initial);
	const disabled = !canEdit || busy !== null;
	const set = (patch: Partial<typeof form>) =>
		setForm((f) => ({ ...f, ...patch }));

	const pressure = numOrNull(form.pressureFinalPsia);
	const pressureOff =
		pressure !== null && Math.abs(pressure - TARGET_PSIA) > TOLERANCE_PSIA;
	const packed = PACKING.filter(([key]) => form[key]).length;

	// A tag other than the saved one has not been tested for this logsheet yet.
	function chooseTag(value: string) {
		const tag = data.tagCandidates.find((t) => String(t.assetId) === value);
		setForm((f) => ({
			...f,
			argosAssetId: value,
			test:
				tag && tag.assetId === data.argosAssetId
					? testFormFrom(data.tagTest)
					: emptyTestForm,
		}));
	}

	async function run(kind: "save", fn: () => Promise<unknown>) {
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
				tagTimeSynced: form.tagTimeSynced,
				tagConfigConfirmed: form.tagConfigConfirmed,
				tagAutoStart: form.tagAutoStart,
				// Only once a tag is chosen: the readings belong to it.
				...(form.argosAssetId !== ""
					? {
							tagTest: testPayload(form.test),
						}
					: {}),
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
					<TextField
						select
						size="small"
						label="Tag (serial)"
						value={form.argosAssetId}
						onChange={(e) => chooseTag(e.target.value)}
						disabled={disabled}
						sx={{ display: "flex", maxWidth: 320, mb: 1 }}
					>
						<MenuItem value="">—</MenuItem>
						{data.tagCandidates.map((t) => (
							<MenuItem key={t.assetId} value={String(t.assetId)}>
								{t.serialNumber ?? `#${t.assetId}`}
								{t.tagName ? ` · ${t.tagName}` : ""}
							</MenuItem>
						))}
					</TextField>
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

					{form.argosAssetId !== "" && (
						<ArgosTagFields
							test={form.test}
							onTest={(patch) =>
								setForm((f) => ({ ...f, test: { ...f.test, ...patch } }))
							}
							disabled={disabled}
							serial={
								data.tagCandidates.find(
									(t) => String(t.assetId) === form.argosAssetId,
								)?.serialNumber ?? null
							}
						/>
					)}

					<Stack sx={{ mt: 1.5 }}>
						{box(
							"tagTimeSynced",
							"Connected to the PC, activated by the magnetic switch, time synced",
						)}
						{box("tagConfigConfirmed", "Configuration confirmed")}
						{box(
							"tagAutoStart",
							"Set to auto-start mode",
							"It turns on when the glider is deployed (on contact with water).",
						)}
					</Stack>
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
