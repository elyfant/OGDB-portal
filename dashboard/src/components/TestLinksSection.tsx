"use client";

import {
	type TestKindPath,
	addTestLink,
	removeTestLink,
	setTestConfirmed,
} from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { RefurbTestGroup, RefurbTestLinks } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

// What to show for a link that has no name: the address without "https://".
const plainUrl = (url: string) => url.replace(/^https?:\/\//i, "");

// Selftest and field test are NOT re-implemented here: they already have their
// own software. The logsheet records that each was done, by whom and when, and
// links to every run there. A glider usually goes through several selftests,
// so the links are a list.
export default function TestLinksSection({
	missionId,
	data,
	canEdit,
	only,
}: {
	missionId: number;
	data: RefurbTestLinks;
	canEdit: boolean;
	// Each test is its own numbered card on the logsheet.
	only: "selftest" | "field_test";
}) {
	if (only === "selftest") {
		return (
			<TestGroup
				missionId={missionId}
				kind="selftest"
				group={data.selftest}
				canEdit={canEdit}
				confirmLabel="Selftest run, and the result is good"
				hint="Run with all devices installed (about 15 minutes). Link every selftest you run; the last one should be the one that passed."
				linkHint="Link to the selftest result"
			/>
		);
	}
	return (
		<TestGroup
			missionId={missionId}
			kind="field-test"
			group={data.fieldTest}
			canEdit={canEdit}
			confirmLabel="Field test done"
			hint="Only if the glider was taken out before being cleared. This never blocks clearing."
			linkHint="Link to the basestation mission"
		/>
	);
}

function TestGroup({
	missionId,
	kind,
	group,
	canEdit,
	confirmLabel,
	hint,
	linkHint,
}: {
	missionId: number;
	kind: TestKindPath;
	group: RefurbTestGroup;
	canEdit: boolean;
	confirmLabel: string;
	hint: string;
	linkHint: string;
}) {
	const router = useRouter();
	const [url, setUrl] = useState("");
	const [label, setLabel] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const disabled = !canEdit || busy;

	async function run(fn: () => Promise<unknown>, after?: () => void) {
		setBusy(true);
		setError(null);
		try {
			await fn();
			after?.();
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Box>
			<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
				{hint}
			</Typography>

			<Paper variant="outlined" sx={{ p: 2 }}>
				<FormControlLabel
					control={
						<Checkbox
							checked={group.confirmed}
							disabled={disabled}
							onChange={(e) =>
								run(() => setTestConfirmed(missionId, kind, e.target.checked))
							}
						/>
					}
					label={confirmLabel}
				/>
				{group.confirmed && group.confirmedAt && (
					<Typography
						variant="caption"
						color="text.secondary"
						display="block"
						sx={{ ml: 4, mt: -0.5, mb: 1 }}
					>
						Confirmed {formatDate(group.confirmedAt)}
						{group.confirmedByName ? ` by ${group.confirmedByName}` : ""}
					</Typography>
				)}

				{group.links.length === 0 ? (
					<Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>
						Nothing linked yet.
					</Typography>
				) : (
					<Stack spacing={0.5} sx={{ my: 1 }}>
						{group.links.map((l) => (
							<Stack
								key={l.id}
								direction="row"
								spacing={1}
								sx={{ alignItems: "center", flexWrap: "wrap" }}
							>
								<MuiLink
									href={l.url}
									target="_blank"
									rel="noopener noreferrer"
									sx={{
										display: "inline-flex",
										alignItems: "center",
										gap: 0.5,
									}}
								>
									{l.label ?? plainUrl(l.url)}
									<OpenInNewIcon sx={{ fontSize: 14 }} />
								</MuiLink>
								{l.label && (
									<Typography variant="caption" color="text.secondary">
										{plainUrl(l.url)}
									</Typography>
								)}
								<Typography variant="caption" color="text.secondary">
									added {formatDate(l.addedAt)}
									{l.addedByName ? ` by ${l.addedByName}` : ""}
								</Typography>
								{canEdit && (
									<IconButton
										size="small"
										aria-label={`Remove ${l.label ?? plainUrl(l.url)}`}
										disabled={disabled}
										onClick={() => run(() => removeTestLink(missionId, l.id))}
									>
										<DeleteOutlineIcon fontSize="small" />
									</IconButton>
								)}
							</Stack>
						))}
					</Stack>
				)}

				{canEdit && (
					<Stack
						direction={{ xs: "column", md: "row" }}
						spacing={1}
						sx={{ mt: 1, alignItems: { md: "flex-start" } }}
					>
						<TextField
							size="small"
							label={linkHint}
							placeholder="https://"
							value={url}
							onChange={(e) => setUrl(e.target.value)}
							disabled={disabled}
							sx={{ flex: 2 }}
						/>
						<TextField
							size="small"
							label="Name (optional)"
							placeholder="e.g. Selftest 3, outdoors"
							value={label}
							onChange={(e) => setLabel(e.target.value)}
							disabled={disabled}
							sx={{ flex: 1 }}
						/>
						<Button
							variant="outlined"
							size="small"
							disabled={disabled || url.trim() === ""}
							onClick={() =>
								run(
									() =>
										addTestLink(
											missionId,
											kind,
											url.trim(),
											label.trim() || null,
										),
									() => {
										setUrl("");
										setLabel("");
									},
								)
							}
							sx={{ whiteSpace: "nowrap", mt: { md: 0.25 } }}
						>
							Add link
						</Button>
					</Stack>
				)}
				{error && (
					<Alert
						severity="error"
						sx={{ mt: 1.5 }}
						onClose={() => setError(null)}
					>
						{error}
					</Alert>
				)}
			</Paper>
		</Box>
	);
}
