"use client";

import {
	linkRmaAsset,
	searchAssets,
	updateRmaAssetReason,
} from "@/lib/api-client";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { AssetSearchResult, LookupOption, RmaAsset } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function resultLabel(r: AssetSearchResult): string {
	return `SN ${r.serialNumber ?? "—"}${r.model ? ` · ${r.model}` : ""}`;
}

function emptyState() {
	return {
		assetTypeId: "" as number | "",
		query: "",
		results: [] as AssetSearchResult[],
		selectedAsset: null as AssetSearchResult | null,
		reason: "",
	};
}

// One dialog for both linking a new asset to an RMA and editing an
// already-linked one's reason -- same "mode decides create-vs-edit,
// externally controlled open in edit mode" convention as
// CalibrationFormDialog. In edit mode the asset itself is locked (which
// asset this row is for can't change through this form), only the
// reason text is editable -- that's Fiona's own explicit ask: the
// reason needs to stay correctable after the fact.
export default function LinkRmaAssetDialog({
	rmaId,
	assetTypes,
	mode,
	row,
	onClose,
}: {
	rmaId: number;
	assetTypes: LookupOption[];
	mode: "link" | "edit";
	row?: RmaAsset | null;
	onClose?: () => void;
}) {
	const router = useRouter();
	const [internalOpen, setInternalOpen] = useState(false);
	const open = mode === "link" ? internalOpen : row != null;

	const [state, setState] = useState(emptyState);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [banner, setBanner] = useState<{
		severity: "success" | "error";
		message: string;
	} | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: row object identity deliberately excluded -- keying on row?.id avoids re-seeding on every parent render
	useEffect(() => {
		if (mode !== "edit" || !row) return;
		setState({ ...emptyState(), reason: row.reason });
		setError(null);
	}, [mode, row?.id]);

	useEffect(() => {
		if (mode !== "link" || state.selectedAsset || !state.assetTypeId) return;
		const type = assetTypes.find((t) => t.id === state.assetTypeId)?.name;
		if (!type) return;
		const handle = setTimeout(() => {
			searchAssets(type, state.query)
				.then((results) => setState((s) => ({ ...s, results })))
				.catch(() => setState((s) => ({ ...s, results: [] })));
		}, 250);
		return () => clearTimeout(handle);
	}, [mode, state.assetTypeId, state.query, state.selectedAsset, assetTypes]);

	function closeDialog() {
		if (mode === "link") setInternalOpen(false);
		else onClose?.();
	}

	function handleOpen() {
		setState(emptyState());
		setError(null);
		setInternalOpen(true);
	}

	function dismissBanner() {
		setBanner(null);
		router.refresh();
	}

	async function handleSave() {
		setError(null);
		if (!state.reason.trim()) {
			setError("Give a reason for this asset.");
			return;
		}
		if (mode === "link" && !state.selectedAsset) {
			setError("Pick an asset.");
			return;
		}

		setSaving(true);
		try {
			if (mode === "link" && state.selectedAsset) {
				await linkRmaAsset(rmaId, {
					assetId: state.selectedAsset.id,
					reason: state.reason.trim(),
				});
			} else if (row) {
				await updateRmaAssetReason(rmaId, row.id, {
					reason: state.reason.trim(),
				});
			}
			closeDialog();
			setBanner({
				severity: "success",
				message: mode === "link" ? "Asset linked." : "Reason updated.",
			});
		} catch (err) {
			setBanner({
				severity: "error",
				message: err instanceof Error ? err.message : "Failed to save.",
			});
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			{mode === "link" && (
				<Button
					variant="contained"
					size="small"
					startIcon={<AddCircleOutlineIcon fontSize="small" />}
					onClick={handleOpen}
				>
					Link asset
				</Button>
			)}

			<Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
				<DialogTitle>
					{mode === "link" ? "Link asset to RMA" : "Edit reason"}
				</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 2 }}
				>
					{mode === "link" &&
						(state.selectedAsset ? (
							<Box
								sx={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									p: 1,
									border: "1px solid",
									borderColor: "divider",
									borderRadius: 1,
								}}
							>
								<Typography variant="body2">
									{resultLabel(state.selectedAsset)}
								</Typography>
								<Button
									size="small"
									onClick={() =>
										setState((s) => ({ ...s, selectedAsset: null, query: "" }))
									}
								>
									Change
								</Button>
							</Box>
						) : (
							<>
								<TextField
									select
									size="small"
									label="Asset type"
									value={state.assetTypeId}
									onChange={(e) =>
										setState((s) => ({
											...s,
											assetTypeId: e.target.value ? Number(e.target.value) : "",
											query: "",
											results: [],
										}))
									}
								>
									<MenuItem value="">— choose a type —</MenuItem>
									{assetTypes.map((t) => (
										<MenuItem key={t.id} value={t.id}>
											{t.name}
										</MenuItem>
									))}
								</TextField>
								<TextField
									size="small"
									label="Search by serial number"
									value={state.query}
									disabled={!state.assetTypeId}
									onChange={(e) =>
										setState((s) => ({ ...s, query: e.target.value }))
									}
								/>
								{state.results.length > 0 && (
									<List dense sx={{ maxHeight: 200, overflowY: "auto" }}>
										{state.results.map((r) => (
											<ListItemButton
												key={r.id}
												onClick={() =>
													setState((s) => ({ ...s, selectedAsset: r }))
												}
											>
												{resultLabel(r)}
											</ListItemButton>
										))}
									</List>
								)}
							</>
						))}

					{mode === "edit" && row && (
						<Typography variant="body2" color="text.secondary">
							SN {row.assetSerialNumber ?? "—"}
						</Typography>
					)}

					<TextField
						multiline
						minRows={3}
						size="small"
						label="Reason"
						placeholder="e.g. Dvalin-873 aft leak 2024 sep, nick partly across aft o-ring face"
						value={state.reason}
						onChange={(e) =>
							setState((s) => ({ ...s, reason: e.target.value }))
						}
					/>

					{error && (
						<Typography color="error" variant="body2">
							{error}
						</Typography>
					)}
				</DialogContent>
				<DialogActions sx={{ px: 3, py: 1.5 }}>
					<Button onClick={closeDialog} disabled={saving}>
						Cancel
					</Button>
					<Button variant="contained" onClick={handleSave} disabled={saving}>
						{saving
							? "Saving…"
							: mode === "link"
								? "Link asset"
								: "Save changes"}
					</Button>
				</DialogActions>
			</Dialog>

			<Snackbar
				open={banner !== null}
				onClose={dismissBanner}
				anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
			>
				<Alert
					severity={banner?.severity}
					variant="filled"
					sx={{ maxWidth: 480 }}
					action={
						<Button color="inherit" size="small" onClick={dismissBanner}>
							OK
						</Button>
					}
				>
					{banner?.message}
				</Alert>
			</Snackbar>
		</>
	);
}
