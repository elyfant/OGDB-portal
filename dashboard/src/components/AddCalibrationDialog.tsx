"use client";

import { recordCalibration, searchAssets } from "@/lib/api-client";
import {
	CAL_FIELDS,
	SCIENCE_ASSET_TYPES,
	coerceCalibrationInput,
} from "@/lib/calibration-fields";
import { formatAssetType, formatFieldName } from "@/lib/format";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { AssetSearchResult } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function resultLabel(r: AssetSearchResult): string {
	return `SN ${r.serialNumber ?? "—"} · ${r.model ?? "—"}`;
}

function initialState() {
	return {
		assetType: SCIENCE_ASSET_TYPES[0],
		query: "",
		results: [] as AssetSearchResult[],
		selectedAsset: null as AssetSearchResult | null,
		calDate: today(),
		facility: "",
		fields: {} as Record<string, string>,
		certificate: null as File | null,
	};
}

export default function AddCalibrationDialog() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [state, setState] = useState(initialState);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (state.selectedAsset) return;
		const handle = setTimeout(() => {
			searchAssets(state.assetType, state.query)
				.then((results) => setState((s) => ({ ...s, results })))
				.catch(() => setState((s) => ({ ...s, results: [] })));
		}, 250);
		return () => clearTimeout(handle);
	}, [state.assetType, state.query, state.selectedAsset]);

	function reset() {
		setState(initialState());
		setError(null);
	}

	async function handleSave() {
		setError(null);
		if (!state.selectedAsset) {
			setError("Search for and pick an asset first.");
			return;
		}
		if (!state.calDate) {
			setError("Pick the calibration date.");
			return;
		}
		const coefficients: Record<string, number | string> = {};
		if (state.facility.trim()) {
			coefficients.calibration_facility = state.facility.trim();
		}
		for (const field of CAL_FIELDS[state.assetType] ?? []) {
			const raw = state.fields[field];
			if (!raw || !raw.trim()) continue;
			coefficients[field] = coerceCalibrationInput(raw);
		}

		setSaving(true);
		try {
			await recordCalibration(
				state.selectedAsset.id,
				{ calDate: state.calDate, coefficients },
				state.certificate ?? undefined,
			);
			setOpen(false);
			reset();
			router.refresh();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to save calibration.",
			);
		} finally {
			setSaving(false);
		}
	}

	const coefficientFields = CAL_FIELDS[state.assetType] ?? [];

	return (
		<>
			<Button
				variant="contained"
				startIcon={<AddCircleOutlineIcon />}
				onClick={() => setOpen(true)}
			>
				Add calibration coefficients
			</Button>

			<Dialog
				open={open}
				onClose={() => setOpen(false)}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>Add calibration coefficients</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 2 }}
				>
					<TextField
						select
						size="small"
						label="Asset type"
						value={state.assetType}
						disabled={!!state.selectedAsset}
						onChange={(e) =>
							setState((s) => ({
								...initialState(),
								assetType: e.target.value,
							}))
						}
					>
						{SCIENCE_ASSET_TYPES.map((t) => (
							<MenuItem key={t} value={t}>
								{formatAssetType(t)}
							</MenuItem>
						))}
					</TextField>

					{state.selectedAsset ? (
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								gap: 1,
								border: "1px solid",
								borderColor: "divider",
								borderRadius: 1,
								px: 1.25,
								py: 0.75,
							}}
						>
							<span style={{ fontFamily: "monospace", fontSize: 13 }}>
								{resultLabel(state.selectedAsset)}
							</span>
							<Button
								size="small"
								onClick={() =>
									setState((s) => ({
										...s,
										selectedAsset: null,
										query: "",
										results: [],
									}))
								}
							>
								Change
							</Button>
						</Box>
					) : (
						<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
							<TextField
								size="small"
								placeholder="Search by serial number…"
								value={state.query}
								onChange={(e) =>
									setState((s) => ({ ...s, query: e.target.value }))
								}
							/>
							<Box
								sx={{
									border: "1px solid",
									borderColor: "divider",
									borderRadius: 1,
									maxHeight: 160,
									overflowY: "auto",
								}}
							>
								{state.results.map((r) => (
									<Box
										key={r.id}
										onClick={() =>
											setState((s) => ({ ...s, selectedAsset: r }))
										}
										sx={{
											display: "flex",
											justifyContent: "space-between",
											gap: 1,
											px: 1.25,
											py: 0.75,
											cursor: "pointer",
											fontSize: 13,
											"&:hover": { bgcolor: "action.hover" },
										}}
									>
										<span style={{ fontFamily: "monospace" }}>
											SN {r.serialNumber ?? "—"}
										</span>
										<Typography variant="body2" color="text.secondary">
											{r.model ?? "—"}
										</Typography>
									</Box>
								))}
								{state.results.length === 0 && (
									<Typography
										variant="body2"
										color="text.disabled"
										sx={{ px: 1.25, py: 0.75 }}
									>
										No matches.
									</Typography>
								)}
							</Box>
						</Box>
					)}

					<Box sx={{ display: "flex", gap: 2 }}>
						<TextField
							size="small"
							type="date"
							label="Calibration date"
							value={state.calDate}
							onChange={(e) =>
								setState((s) => ({ ...s, calDate: e.target.value }))
							}
							InputLabelProps={{ shrink: true }}
							sx={{ flex: 1 }}
						/>
						<TextField
							size="small"
							label="Facility"
							value={state.facility}
							onChange={(e) =>
								setState((s) => ({ ...s, facility: e.target.value }))
							}
							sx={{ flex: 1 }}
						/>
					</Box>

					{state.assetType === "ct_sensor" && (
						<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
							<Button component="label" size="small">
								{state.certificate
									? state.certificate.name
									: "Attach certificate (PDF)"}
								<input
									type="file"
									accept="application/pdf"
									hidden
									onChange={(e) =>
										setState((s) => ({
											...s,
											certificate: e.target.files?.[0] ?? null,
										}))
									}
								/>
							</Button>
							{state.certificate && (
								<Button
									size="small"
									onClick={() => setState((s) => ({ ...s, certificate: null }))}
								>
									Remove
								</Button>
							)}
						</Box>
					)}

					{coefficientFields.length > 0 && (
						<Box>
							<Typography
								variant="caption"
								color="text.secondary"
								sx={{ display: "block", mb: 1 }}
							>
								Coefficients — leave any field blank to skip it
							</Typography>
							<Box
								sx={{
									display: "grid",
									gridTemplateColumns: {
										xs: "1fr 1fr",
										sm: "repeat(3, 1fr)",
									},
									gap: 1.25,
								}}
							>
								{coefficientFields.map((field) => (
									<TextField
										key={field}
										size="small"
										label={formatFieldName(field)}
										value={state.fields[field] ?? ""}
										onChange={(e) =>
											setState((s) => ({
												...s,
												fields: { ...s.fields, [field]: e.target.value },
											}))
										}
										sx={{
											"& input": { fontFamily: "monospace", fontSize: 12 },
										}}
									/>
								))}
							</Box>
						</Box>
					)}

					{error && (
						<Typography color="error" variant="body2">
							{error}
						</Typography>
					)}
				</DialogContent>
				<DialogActions sx={{ px: 3, py: 1.5 }}>
					<Button
						onClick={() => {
							setOpen(false);
							reset();
						}}
						disabled={saving}
					>
						Cancel
					</Button>
					<Button variant="contained" onClick={handleSave} disabled={saving}>
						{saving ? "Saving…" : "Save calibration"}
					</Button>
				</DialogActions>
			</Dialog>
		</>
	);
}
