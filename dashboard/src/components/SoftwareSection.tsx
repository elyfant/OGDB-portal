"use client";

import { saveRefurbSoftware } from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type {
	RefurbSoftware,
	RefurbSoftwareCleanup,
	SoftwareCleanupStage,
	SoftwareCleanupTarget,
} from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Where the commands for the cleanup steps are written down. Shown as a link
// only when it is configured, so no address is invented here.
const SOP_URL = process.env.NEXT_PUBLIC_GLIDERPAGE_SOP_URL;

const TARGET_LABELS: Record<
	SoftwareCleanupTarget,
	{ label: string; hint?: string }
> = {
	backup: {
		label: "Everything backed up on gliderbak",
		hint: "Confirm before anything is removed from the servers.",
	},
	basestation: {
		label: "Basestation home directory cleaned",
		hint: "Data moved into a mission sub-directory under the glider's home directory.",
	},
	gliders: {
		label: "gliders.gfi.uib.no cleaned (master)",
		hint: "For missions this includes the glconf update and a fake glider call.",
	},
	glider: {
		label: "glider.gfi.uib.no cleaned (backup, NREC cloud)",
		hint: "For missions this includes the glconf update and a fake glider call.",
	},
	gp: {
		label: "gp.gfi.uib.no cleaned",
		hint: "Updated by the first dive, so no fake glider call is needed.",
	},
};

type FlagKey =
	| "flashcardCopied"
	| "flashcardFormatted"
	| "simdiveCmdfileUploaded"
	| "simdiveScienceUploaded"
	| "simdiveDataOk"
	| "simdiveGliderOff"
	| "filesScience"
	| "filesCmdfile"
	| "filesTargets"
	| "filesCalibConstants"
	| "filesPagersUrlsLogout";

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const cleanupKey = (c: Pick<RefurbSoftwareCleanup, "stage" | "target">) =>
	`${c.stage}/${c.target}`;

function initialForm(d: RefurbSoftware) {
	return {
		flashcardCopied: d.flashcardCopied,
		flashcardFormatted: d.flashcardFormatted,
		simdiveCmdfileUploaded: d.simdiveCmdfileUploaded,
		simdiveScienceUploaded: d.simdiveScienceUploaded,
		simdiveDives: str(d.simdiveDives),
		simdiveDataOk: d.simdiveDataOk,
		simdiveGliderOff: d.simdiveGliderOff,
		simdiveNotes: str(d.simdiveNotes),
		filesScience: d.filesScience,
		filesCmdfile: d.filesCmdfile,
		filesTargets: d.filesTargets,
		filesCalibConstants: d.filesCalibConstants,
		filesPagersUrlsLogout: d.filesPagersUrlsLogout,
		filesOther: str(d.filesOther),
		cleanups: Object.fromEntries(
			d.cleanups.map((c) => [cleanupKey(c), c.done]),
		),
	};
}

// Sections 10, 12, 13 and 17 of the refurbishment logsheet. The commands for
// cleaning the basestation and the three gliderpage servers are in the SOP;
// here each server is a tick, and the first person to confirm a step stays on
// the record with the time.
export default function SoftwareSection({
	missionId,
	data,
	canEdit,
}: {
	missionId: number;
	data: RefurbSoftware;
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
	const setCleanup = (key: string, done: boolean) =>
		setForm((f) => ({ ...f, cleanups: { ...f.cleanups, [key]: done } }));

	const diveCount =
		form.simdiveDives.trim() === "" ? null : Number(form.simdiveDives);

	async function save() {
		setBusy(true);
		setError(null);
		try {
			await saveRefurbSoftware(missionId, {
				flashcardCopied: form.flashcardCopied,
				flashcardFormatted: form.flashcardFormatted,
				simdiveCmdfileUploaded: form.simdiveCmdfileUploaded,
				simdiveScienceUploaded: form.simdiveScienceUploaded,
				simdiveDives: diveCount,
				simdiveDataOk: form.simdiveDataOk,
				simdiveGliderOff: form.simdiveGliderOff,
				simdiveNotes: form.simdiveNotes.trim() || null,
				filesScience: form.filesScience,
				filesCmdfile: form.filesCmdfile,
				filesTargets: form.filesTargets,
				filesCalibConstants: form.filesCalibConstants,
				filesPagersUrlsLogout: form.filesPagersUrlsLogout,
				filesOther: form.filesOther.trim() || null,
				// Only the ticks that changed, so nobody's earlier confirmation
				// is overwritten.
				cleanups: data.cleanups
					.filter((c) => form.cleanups[cleanupKey(c)] !== c.done)
					.map((c) => ({
						stage: c.stage,
						target: c.target,
						done: form.cleanups[cleanupKey(c)],
					})),
			});
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save.");
		} finally {
			setBusy(false);
		}
	}

	const flag = (
		key: FlagKey,
		label: string,
		hint?: string,
		lockedReason?: string,
	) => (
		<Box key={key}>
			<FormControlLabel
				control={
					<Checkbox
						checked={form[key]}
						disabled={disabled || Boolean(lockedReason)}
						onChange={(e) =>
							// Un-ticking the copy also un-ticks the format: it can't stand without it.
							set({
								[key]: e.target.checked,
								...(key === "flashcardCopied" && !e.target.checked
									? { flashcardFormatted: false }
									: {}),
							})
						}
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
					{lockedReason ?? hint}
				</Typography>
			)}
		</Box>
	);

	const cleanupGroup = (
		stage: SoftwareCleanupStage,
		title: string,
		intro: string,
	) => (
		<Paper variant="outlined" sx={{ p: 2 }}>
			<Typography variant="subtitle2">{title}</Typography>
			<Typography
				variant="caption"
				color="text.secondary"
				display="block"
				sx={{ mb: 0.5 }}
			>
				{intro}
			</Typography>
			<Stack>
				{data.cleanups
					.filter((c) => c.stage === stage)
					.map((c) => {
						const key = cleanupKey(c);
						const meta = TARGET_LABELS[c.target];
						return (
							<Box key={key}>
								<FormControlLabel
									control={
										<Checkbox
											checked={form.cleanups[key]}
											disabled={disabled}
											onChange={(e) => setCleanup(key, e.target.checked)}
										/>
									}
									label={meta.label}
								/>
								<Typography
									variant="caption"
									color="text.secondary"
									display="block"
									sx={{ ml: 4, mt: -0.5 }}
								>
									{c.done && c.doneAt
										? `Confirmed ${formatDate(c.doneAt)}${c.doneByName ? ` by ${c.doneByName}` : ""}`
										: meta.hint}
								</Typography>
							</Box>
						);
					})}
			</Stack>
		</Paper>
	);

	return (
		<Box>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
				The commands are in the gliderpage SOP
				{SOP_URL && (
					<>
						{" "}
						(
						<MuiLink href={SOP_URL} target="_blank" rel="noreferrer">
							open the SOP
						</MuiLink>
						)
					</>
				)}
				. Tick each step when it is done. The first person to confirm a step
				stays on the record. This part can run alongside the hardware work.
			</Typography>

			<Stack spacing={2}>
				<Paper variant="outlined" sx={{ p: 2 }}>
					<Typography variant="subtitle2">Flash card</Typography>
					<Typography
						variant="caption"
						color="text.secondary"
						display="block"
						sx={{ mb: 0.5 }}
					>
						Secure the previous mission's raw data first, then clear the card
						for the new mission.
					</Typography>
					<Stack>
						{flag(
							"flashcardCopied",
							"Old flash card files copied to /naco/data/delayed/",
							"Under the mission name, in a flashcard folder.",
						)}
						{flag(
							"flashcardFormatted",
							"Flash card formatted",
							"Removes the old data from the card.",
							!form.flashcardCopied
								? "Copy the old files off the card first: formatting destroys them."
								: undefined,
						)}
					</Stack>
				</Paper>

				{cleanupGroup(
					"after_previous_mission",
					"Clean after the previous mission",
					"Do this before the simulation dives. Critical: files must not be overwritten.",
				)}

				<Paper variant="outlined" sx={{ p: 2 }}>
					<Typography variant="subtitle2">Simulation dives</Typography>
					<Typography
						variant="caption"
						color="text.secondary"
						display="block"
						sx={{ mb: 0.5 }}
					>
						With all devices installed. Take the glider outside with a clear
						view of the sky, antenna up, at about 60°. Send $RESUME in the
						cmdfile to start, and $QUIT again after about 3 dives.
					</Typography>
					<Stack>
						{flag(
							"simdiveCmdfileUploaded",
							"Sim-dive cmdfile uploaded via the gliderpage",
						)}
						{flag(
							"simdiveScienceUploaded",
							"Sim-dive science file uploaded via the gliderpage",
						)}
					</Stack>
					<TextField
						size="small"
						label="Dives completed"
						value={form.simdiveDives}
						onChange={(e) => set({ simdiveDives: e.target.value })}
						disabled={disabled}
						helperText="About 3."
						slotProps={{ htmlInput: { inputMode: "numeric" } }}
						sx={{ my: 1, maxWidth: 220 }}
					/>
					<Stack>
						{flag(
							"simdiveDataOk",
							"Dive data checked and OK",
							"Dive plot, science sensors, GaaG, GPS and the pop-up window look right, and everything shows up properly in the gliderpage.",
						)}
						{flag(
							"simdiveGliderOff",
							"Glider turned off",
							"Once all dives have transferred to the basestation.",
						)}
					</Stack>
					<TextField
						size="small"
						fullWidth
						multiline
						minRows={2}
						label="Notes"
						value={form.simdiveNotes}
						onChange={(e) => set({ simdiveNotes: e.target.value })}
						disabled={disabled}
						sx={{ mt: 1 }}
					/>
				</Paper>

				{cleanupGroup(
					"after_simdives",
					"Clean again after the sim dives",
					"Confirm the files are synced to gliderbak, then clean the basestation and servers as before.",
				)}

				<Paper variant="outlined" sx={{ p: 2 }}>
					<Typography variant="subtitle2">Mission files</Typography>
					<Typography
						variant="caption"
						color="text.secondary"
						display="block"
						sx={{ mb: 0.5 }}
					>
						Prepared for the upcoming mission on the basestation and gliderpage.
					</Typography>
					<Stack>
						{flag("filesScience", "science")}
						{flag("filesCmdfile", "cmdfile")}
						{flag("filesTargets", "targets")}
						{flag("filesCalibConstants", "sg_calib_constants.m")}
						{flag(
							"filesPagersUrlsLogout",
							".pagers, .urls and .logout set up correctly",
						)}
					</Stack>
					<TextField
						size="small"
						fullWidth
						label="Other files"
						value={form.filesOther}
						onChange={(e) => set({ filesOther: e.target.value })}
						disabled={disabled}
						sx={{ mt: 1 }}
					/>
				</Paper>
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
					disabled={!dirty || busy}
				>
					{busy ? "Saving…" : "Save"}
				</Button>
			)}
		</Box>
	);
}
