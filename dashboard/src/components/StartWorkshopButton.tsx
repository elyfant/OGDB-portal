"use client";

import { createWorkshop } from "@/lib/api-client";
import BuildIcon from "@mui/icons-material/Build";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Starts the glider's workshop: a mission with only the glider known, seeded
// as a copy of its last flown build. The tech then edits that build on the
// mission page. Goes straight to the new mission.
export default function StartWorkshopButton({
	gliderId,
}: { gliderId: number }) {
	const router = useRouter();
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function start() {
		setSaving(true);
		setError(null);
		try {
			const created = await createWorkshop(gliderId);
			router.push(`/missions/${created.id}`);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to start workshop.",
			);
			setSaving(false);
		}
	}

	return (
		<>
			<Button
				variant="contained"
				size="small"
				startIcon={<BuildIcon fontSize="small" />}
				onClick={start}
				disabled={saving}
			>
				{saving ? "Starting…" : "Start workshop"}
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
