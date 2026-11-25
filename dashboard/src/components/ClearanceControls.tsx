"use client";

import { clearRefurbishment, unlockRefurbishment } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { RefurbClearanceEvent } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Clear for deployment, and unlock again. Clearing records the person doing it
// (the operator) and LOCKS the logsheet: nothing in it can be changed. Unlocking
// withdraws the clearance, needs a reason, and is kept in the history.
export default function ClearanceControls({
	missionId,
	ready,
	clearedAt,
	clearedByName,
	history,
	canEdit,
}: {
	missionId: number;
	// Every required section is done.
	ready: boolean;
	clearedAt: string | null;
	clearedByName: string | null;
	history: RefurbClearanceEvent[];
	canEdit: boolean;
}) {
	const router = useRouter();
	const [dialog, setDialog] = useState<"clear" | "unlock" | null>(null);
	const [reason, setReason] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showHistory, setShowHistory] = useState(false);

	const locked = clearedAt !== null;

	async function run(fn: () => Promise<unknown>) {
		setBusy(true);
		setError(null);
		try {
			await fn();
			setDialog(null);
			setReason("");
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Box>
			{locked ? (
				<Alert
					severity="success"
					icon={<LockIcon fontSize="inherit" />}
					action={
						canEdit && (
							<Button
								color="inherit"
								size="small"
								startIcon={<LockOpenIcon fontSize="small" />}
								onClick={() => {
									setError(null);
									setDialog("unlock");
								}}
							>
								Unlock…
							</Button>
						)
					}
				>
					Cleared for deployment
					{clearedByName ? ` by ${clearedByName}` : ""} on{" "}
					{formatDateTime(clearedAt)}. The logsheet is locked.
				</Alert>
			) : (
				<Stack
					direction="row"
					spacing={1.5}
					sx={{ alignItems: "center", flexWrap: "wrap" }}
				>
					<Button
						variant="contained"
						size="small"
						startIcon={<LockIcon fontSize="small" />}
						disabled={!ready || !canEdit}
						onClick={() => {
							setError(null);
							setDialog("clear");
						}}
					>
						Clear for deployment
					</Button>
					<Typography variant="body2" color="text.secondary">
						{ready
							? "Records you as the operator and locks the logsheet."
							: "Available when every required section is done."}
					</Typography>
				</Stack>
			)}

			{history.length > 0 && (
				<Box sx={{ mt: 1 }}>
					<Button size="small" onClick={() => setShowHistory((v) => !v)}>
						{showHistory ? "Hide history" : `History (${history.length})`}
					</Button>
					<Collapse in={showHistory}>
						<Stack spacing={0.5} sx={{ mt: 0.5, pl: 1 }}>
							{history.map((h) => (
								<Typography key={h.id} variant="body2" color="text.secondary">
									{h.action === "cleared" ? "Cleared" : "Unlocked"}
									{h.byName ? ` by ${h.byName}` : ""} · {formatDateTime(h.at)}
									{h.reason ? ` — ${h.reason}` : ""}
								</Typography>
							))}
						</Stack>
					</Collapse>
				</Box>
			)}

			<Dialog
				open={dialog === "clear"}
				onClose={() => !busy && setDialog(null)}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle>Clear for deployment?</DialogTitle>
				<DialogContent>
					<DialogContentText>
						This records you as the operator who cleared the glider, and locks
						the logsheet so nothing in it can be changed. You can unlock it
						later if you need to.
					</DialogContentText>
					{error && (
						<Alert severity="error" sx={{ mt: 2 }}>
							{error}
						</Alert>
					)}
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setDialog(null)} disabled={busy}>
						Cancel
					</Button>
					<Button
						variant="contained"
						onClick={() => run(() => clearRefurbishment(missionId))}
						disabled={busy}
					>
						{busy ? "Clearing…" : "Clear and lock"}
					</Button>
				</DialogActions>
			</Dialog>

			<Dialog
				open={dialog === "unlock"}
				onClose={() => !busy && setDialog(null)}
				maxWidth="xs"
				fullWidth
			>
				<DialogTitle>Unlock the logsheet?</DialogTitle>
				<DialogContent>
					<DialogContentText sx={{ mb: 2 }}>
						Unlocking withdraws the clearance. When the changes are done, the
						glider has to be cleared again.
					</DialogContentText>
					<TextField
						autoFocus
						fullWidth
						size="small"
						multiline
						minRows={2}
						label="Why is it being unlocked?"
						value={reason}
						onChange={(e) => setReason(e.target.value)}
						disabled={busy}
					/>
					{error && (
						<Alert severity="error" sx={{ mt: 2 }}>
							{error}
						</Alert>
					)}
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setDialog(null)} disabled={busy}>
						Cancel
					</Button>
					<Button
						variant="contained"
						color="warning"
						onClick={() => run(() => unlockRefurbishment(missionId, reason))}
						disabled={busy || reason.trim().length < 3}
					>
						{busy ? "Unlocking…" : "Unlock"}
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}
