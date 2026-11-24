"use client";

import {
	deleteOldTagScreenshot,
	saveRefurbIntake,
	uploadOldTagScreenshots,
} from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { RefurbIntake } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const SEVERITY_COLOR: Record<string, "default" | "warning" | "error"> = {
	low: "default",
	medium: "warning",
	high: "error",
	critical: "error",
};

type FlagKey =
	| "issuesReviewed"
	| "tagRemoved"
	| "tagActivated"
	| "tagTestOk"
	| "tagStopped";

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function initialForm(d: RefurbIntake) {
	return {
		issuesReviewed: d.issuesReviewed,
		issuesNotes: str(d.issuesNotes),
		oldTagAssetId: d.oldTagAssetId === null ? "" : String(d.oldTagAssetId),
		tagRemoved: d.tagRemoved,
		tagActivated: d.tagActivated,
		tagTestOk: d.tagTestOk,
		tagBatteryOk: d.tagBatteryOk === null ? "" : String(d.tagBatteryOk),
		tagStopped: d.tagStopped,
	};
}

// The start of the refurbishment: look at what went wrong on the previous
// mission, and retire the Argos tag that flew on it. The problems are READ
// from the mission and the fault log, not typed, so they cannot go stale.
export default function IntakeSection({
	missionId,
	data,
	canEdit,
}: {
	missionId: number;
	data: RefurbIntake;
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
	const prev = data.previousMission;

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
			saveRefurbIntake(missionId, {
				issuesReviewed: form.issuesReviewed,
				issuesNotes: form.issuesNotes.trim() || null,
				oldTagAssetId:
					form.oldTagAssetId === "" ? null : Number(form.oldTagAssetId),
				tagRemoved: form.tagRemoved,
				tagActivated: form.tagActivated,
				tagTestOk: form.tagTestOk,
				tagBatteryOk:
					form.tagBatteryOk === "" ? null : form.tagBatteryOk === "true",
				tagStopped: form.tagStopped,
			}),
		);

	const box = (key: FlagKey, label: string, hint?: string) => (
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
						Previous mission
					</Typography>
					{prev ? (
						<>
							<Typography variant="body2">
								<MuiLink href={`/missions/${prev.id}`}>
									{prev.missionNumber !== null ? `${prev.missionNumber}. ` : ""}
									{prev.name}
								</MuiLink>
								{prev.retrievalDate &&
									` · retrieved ${formatDate(prev.retrievalDate)}`}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								Why it ended:{" "}
								{prev.endingCause ?? "not recorded on the mission"}
							</Typography>
						</>
					) : (
						<Typography variant="body2" color="text.secondary">
							This glider has no earlier mission on record.
						</Typography>
					)}

					<Typography variant="body2" sx={{ fontWeight: 600, mt: 1.5 }}>
						Open faults on the glider and its parts
					</Typography>
					{data.openFaults.length === 0 ? (
						<Typography variant="body2" color="text.secondary">
							None recorded.
						</Typography>
					) : (
						<Stack spacing={0.75} sx={{ mt: 0.5 }}>
							{data.openFaults.map((f) => (
								<Box key={f.id}>
									<Stack
										direction="row"
										spacing={1}
										sx={{ alignItems: "center", flexWrap: "wrap" }}
									>
										<Chip
											size="small"
											label={f.severity}
											color={SEVERITY_COLOR[f.severity] ?? "default"}
										/>
										<Typography variant="body2" sx={{ fontWeight: 600 }}>
											{f.assetLabel}
										</Typography>
										<Typography variant="caption" color="text.secondary">
											{f.status.replace("_", " ")} · reported{" "}
											{formatDate(f.reportedDate)}
										</Typography>
									</Stack>
									<Typography variant="body2">{f.description}</Typography>
								</Box>
							))}
						</Stack>
					)}

					<TextField
						size="small"
						fullWidth
						multiline
						minRows={2}
						label="What was found, and what will be done about it"
						value={form.issuesNotes}
						onChange={(e) => set({ issuesNotes: e.target.value })}
						disabled={disabled}
						sx={{ mt: 1.5 }}
					/>
					{box(
						"issuesReviewed",
						"I have reviewed the previous mission's problems",
					)}
				</Paper>

				<Paper variant="outlined" sx={{ p: 2 }}>
					<Typography variant="subtitle2" sx={{ mb: 1 }}>
						Old Argos tag
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
							value={form.oldTagAssetId}
							onChange={(e) => set({ oldTagAssetId: e.target.value })}
							disabled={disabled}
							helperText="The tag that flew on the previous mission."
						>
							<MenuItem value="">—</MenuItem>
							{data.tagCandidates.map((t) => (
								<MenuItem key={t.id} value={String(t.id)}>
									{t.serialNumber ?? `#${t.id}`}
								</MenuItem>
							))}
						</TextField>
					</Box>
					<Stack>
						{box("tagRemoved", "Removed from the glider antenna")}
						{box(
							"tagActivated",
							"Connected to the PC and activated",
							"Open Tag Agent and activate the tag with the magnetic switch.",
						)}
						{box("tagTestOk", "Test transmission run and OK")}
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
													deleteOldTagScreenshot(missionId, s.id),
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
											uploadOldTagScreenshots(missionId, files),
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

					<TextField
						select
						size="small"
						label="Battery good for another mission?"
						value={form.tagBatteryOk}
						onChange={(e) => set({ tagBatteryOk: e.target.value })}
						disabled={disabled}
						sx={{ display: "flex", maxWidth: 320, mt: 2 }}
					>
						<MenuItem value="">—</MenuItem>
						<MenuItem value="true">Yes</MenuItem>
						<MenuItem value="false">No, replace it</MenuItem>
					</TextField>
					<Stack sx={{ mt: 1 }}>
						{box("tagStopped", "Set to stop mode and disconnected")}
					</Stack>
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
					disabled={!dirty || busy !== null}
				>
					{busy === "save" ? "Saving…" : "Save"}
				</Button>
			)}
		</Box>
	);
}
