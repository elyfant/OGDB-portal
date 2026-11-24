"use client";

import { startRefurbishment } from "@/lib/api-client";
import AssignmentIcon from "@mui/icons-material/Assignment";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Starts the refurbishment logsheet for a workshop mission. Stays on the
// page: the section re-renders with the logsheet header.
export default function StartRefurbishmentButton({
	missionId,
}: { missionId: number }) {
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function start() {
		setSaving(true);
		setError(null);
		try {
			await startRefurbishment(missionId);
			router.refresh();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to start refurbishment.",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<Button
				variant="contained"
				size="small"
				startIcon={<AssignmentIcon fontSize="small" />}
				onClick={start}
				disabled={saving}
			>
				{saving ? "Starting…" : "Start refurbishment logsheet"}
			</Button>
			<Snackbar
				open={error !== null}
				onClose={() => setError(null)}
				anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
			>
				<Alert severity="error" variant="filled" onClose={() => setError(null)}>
					{error}
				</Alert>
			</Snackbar>
		</>
	);
}
