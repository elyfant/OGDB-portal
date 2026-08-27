"use client";

import { saveMissionFiles } from "@/lib/api-client";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import UndoIcon from "@mui/icons-material/Undo";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Typography from "@mui/material/Typography";
import type { MissionFile, MissionFilesSaveResult } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

// Kept in sync with ALLOWED_MISSION_FILE_EXTENSIONS in the gateway's
// missions.controller -- used for the <input accept> hint and the
// human-readable line below the picker. The gateway is the real
// gatekeeper; this just steers the file dialog.
const ACCEPT =
	".txt,.text,.asc,.ascii,.dat,.log,.cfg,.ini,.m,.md,.csv,.tsv,.json,.xml,.yaml,.yml,.pdf,.png,.jpg,.jpeg,.gif,.webp";

export default function MissionFilesEditor({
	missionId,
	files,
}: {
	missionId: number;
	files: MissionFile[];
}) {
	const router = useRouter();
	const inputRef = useRef<HTMLInputElement>(null);
	const [open, setOpen] = useState(false);
	const [toDelete, setToDelete] = useState<Set<number>>(new Set());
	const [newFiles, setNewFiles] = useState<File[]>([]);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<MissionFilesSaveResult | null>(null);

	function reset() {
		setToDelete(new Set());
		setNewFiles([]);
		setError(null);
	}

	function close() {
		setOpen(false);
		reset();
	}

	function toggleDelete(id: number) {
		setToDelete((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function addPicked(list: FileList | null) {
		if (!list) return;
		const picked = Array.from(list);
		setNewFiles((prev) => {
			// De-dupe by name+size so re-opening the picker doesn't stack the
			// same file twice.
			const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
			return [
				...prev,
				...picked.filter((f) => !seen.has(`${f.name}:${f.size}`)),
			];
		});
	}

	function removePicked(index: number) {
		setNewFiles((prev) => prev.filter((_, i) => i !== index));
	}

	const nothingToDo = toDelete.size === 0 && newFiles.length === 0;

	async function handleSave() {
		setError(null);
		setSaving(true);
		try {
			const saved = await saveMissionFiles(
				missionId,
				newFiles,
				Array.from(toDelete),
			);
			setOpen(false);
			reset();
			// router.refresh() is deferred until the banner is dismissed, so
			// the summary isn't swapped out from under the user -- same
			// reasoning as GliderBuildEditor.
			setResult(saved);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save files.");
		} finally {
			setSaving(false);
		}
	}

	function dismissBanner() {
		setResult(null);
		router.refresh();
	}

	return (
		<>
			<Button
				variant="contained"
				size="small"
				startIcon={<AddIcon fontSize="small" />}
				onClick={() => setOpen(true)}
			>
				Add key mission file
			</Button>

			<Dialog open={open} onClose={close} maxWidth="sm" fullWidth>
				<DialogTitle>Add key mission file</DialogTitle>
				<DialogContent dividers>
					<Typography
						variant="overline"
						sx={{ color: "text.secondary", letterSpacing: 1 }}
					>
						Files on this mission
					</Typography>
					{files.length === 0 ? (
						<Typography variant="body2" color="text.disabled" sx={{ mb: 2 }}>
							None yet.
						</Typography>
					) : (
						<Box sx={{ mb: 2 }}>
							{files.map((file) => {
								const marked = toDelete.has(file.id);
								return (
									<Box
										key={file.id}
										sx={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: 1,
											borderTop: "1px solid",
											borderColor: "divider",
											py: 0.75,
										}}
									>
										<Typography
											variant="body2"
											sx={{
												minWidth: 0,
												wordBreak: "break-all",
												textDecoration: marked ? "line-through" : "none",
												color: marked ? "text.disabled" : "text.primary",
											}}
										>
											{file.name}
										</Typography>
										<IconButton
											size="small"
											color={marked ? "default" : "error"}
											onClick={() => toggleDelete(file.id)}
											aria-label={marked ? "Keep file" : "Delete file"}
										>
											{marked ? (
												<UndoIcon fontSize="small" />
											) : (
												<DeleteOutlineIcon fontSize="small" />
											)}
										</IconButton>
									</Box>
								);
							})}
						</Box>
					)}

					<Typography
						variant="overline"
						sx={{ color: "text.secondary", letterSpacing: 1 }}
					>
						Add files
					</Typography>
					<Box sx={{ mt: 0.5 }}>
						<input
							ref={inputRef}
							type="file"
							multiple
							accept={ACCEPT}
							hidden
							onChange={(e) => {
								addPicked(e.target.files);
								e.target.value = "";
							}}
						/>
						<Button
							size="small"
							variant="outlined"
							startIcon={<UploadFileIcon fontSize="small" />}
							onClick={() => inputRef.current?.click()}
						>
							Choose files
						</Button>
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{ display: "block", mt: 0.75 }}
						>
							Text/ascii, CSV, JSON/XML, PDF or images. Max 20&nbsp;MB each.
						</Typography>

						{newFiles.length > 0 && (
							<Box sx={{ mt: 1 }}>
								{newFiles.map((file, i) => (
									<Box
										key={`${file.name}:${file.size}`}
										sx={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: 1,
											py: 0.5,
										}}
									>
										<Typography
											variant="body2"
											sx={{ minWidth: 0, wordBreak: "break-all" }}
										>
											{file.name}
										</Typography>
										<IconButton
											size="small"
											onClick={() => removePicked(i)}
											aria-label="Remove"
										>
											<DeleteOutlineIcon fontSize="small" />
										</IconButton>
									</Box>
								))}
							</Box>
						)}
					</Box>

					{error && (
						<Typography color="error" variant="body2" sx={{ mt: 2 }}>
							{error}
						</Typography>
					)}
				</DialogContent>
				<DialogActions sx={{ justifyContent: "space-between", px: 3, py: 1.5 }}>
					<Typography variant="caption" color="text.secondary">
						{newFiles.length} to add, {toDelete.size} to remove
					</Typography>
					<Box sx={{ display: "flex", gap: 1 }}>
						<Button onClick={close} disabled={saving}>
							Cancel
						</Button>
						<Button
							variant="contained"
							onClick={handleSave}
							disabled={saving || nothingToDo}
						>
							{saving ? "Saving…" : "Save"}
						</Button>
					</Box>
				</DialogActions>
			</Dialog>

			<Snackbar
				open={result !== null}
				onClose={dismissBanner}
				anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
			>
				<Alert
					severity="success"
					variant="filled"
					sx={{ maxWidth: 480 }}
					action={
						<Button color="inherit" size="small" onClick={dismissBanner}>
							OK
						</Button>
					}
				>
					<AlertTitle>Key files updated</AlertTitle>
					{result?.saved.map((name) => (
						<Typography key={`saved-${name}`} variant="body2">
							Saved {name}
						</Typography>
					))}
					{result?.deleted.map((name) => (
						<Typography key={`deleted-${name}`} variant="body2">
							Deleted {name}
						</Typography>
					))}
				</Alert>
			</Snackbar>
		</>
	);
}
