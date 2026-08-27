"use client";

import {
	parseCertificate,
	recordCalibration,
	searchAssets,
	updateCalibration,
} from "@/lib/api-client";
import {
	CAL_FIELDS,
	SCIENCE_ASSET_TYPES,
	coerceCalibrationInput,
} from "@/lib/calibration-fields";
import { formatAssetType, formatFieldName } from "@/lib/format";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { AssetSearchResult, CalibrationCatalogueRow } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const SCRAPE_CONFIRMATION_LABEL =
	"The PDF scraping of the coefficients in this certificate isn't perfect — I confirm I've double-checked these values myself.";

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

function resultLabel(r: AssetSearchResult): string {
	return `SN ${r.serialNumber ?? "—"} · ${r.model ?? "—"}`;
}

function emptyState() {
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

// Seeds the form straight from an existing calibration row's current
// values. row.coefficients is already split apart per-column, the same
// shape CAL_FIELDS expects, so this just stringifies each one back into
// the text-field form the dialog edits -- and folds notes back in as
// just another field, since CAL_FIELDS.ct_sensor already treats "note"
// as one of the ordinary coefficient fields.
function stateFromRow(row: CalibrationCatalogueRow) {
	const fields: Record<string, string> = {};
	for (const [key, value] of Object.entries(row.coefficients)) {
		if (value !== null && value !== undefined) fields[key] = String(value);
	}
	if (row.notes) fields.note = row.notes;
	return {
		assetType: row.assetType,
		query: "",
		results: [] as AssetSearchResult[],
		selectedAsset: {
			id: row.assetId,
			serialNumber: row.serialNumber,
			model: null,
		} as AssetSearchResult,
		calDate: row.calDate.slice(0, 10),
		facility: row.facility ?? "",
		fields,
		certificate: null as File | null,
	};
}

// Same dialog for adding a new calibration and editing an existing one
// -- "edit" just seeds the form from the row being edited instead of a
// blank one, locks the asset type/serial (what's being calibrated can't
// change through this form), and PATCHes instead of POSTs. In edit mode
// the dialog's open/close is externally controlled (row/onClose) since
// the trigger is a per-row icon in CalibrationsCatalogue, not a button
// this component owns.
export default function CalibrationFormDialog({
	mode,
	row,
	onClose,
}: {
	mode: "create" | "edit";
	row?: CalibrationCatalogueRow | null;
	onClose?: () => void;
}) {
	const router = useRouter();
	const [internalOpen, setInternalOpen] = useState(false);
	const open = mode === "create" ? internalOpen : row != null;

	const [state, setState] = useState(emptyState);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [banner, setBanner] = useState<{
		severity: "success" | "error";
		message: string;
	} | null>(null);

	// "Read in certificate" state. scraped tracks whether the currently
	// attached file actually populated something -- that's what the
	// confirmation checkbox gates on, not just "a file is attached"
	// (pure manual entry, or a file the parser couldn't read, has
	// nothing scraped to double-check).
	const [parsing, setParsing] = useState(false);
	const [parseWarning, setParseWarning] = useState<string | null>(null);
	const [scraped, setScraped] = useState(false);
	const [confirmedScrape, setConfirmedScrape] = useState(false);

	// Re-seeds whenever a (different) row is opened for editing -- row?.id
	// going from unset to set covers both "start editing" and "close then
	// edit the same row again" (the parent nulls row on close, so id
	// genuinely changes each time).
	// biome-ignore lint/correctness/useExhaustiveDependencies: row object identity deliberately excluded -- keying on row?.id avoids re-seeding on every parent render
	useEffect(() => {
		if (mode !== "edit" || !row) return;
		setState(stateFromRow(row));
		setError(null);
		setParseWarning(null);
		setScraped(false);
		setConfirmedScrape(false);
	}, [mode, row?.id]);

	useEffect(() => {
		if (state.selectedAsset) return;
		const handle = setTimeout(() => {
			searchAssets(state.assetType, state.query)
				.then((results) => setState((s) => ({ ...s, results })))
				.catch(() => setState((s) => ({ ...s, results: [] })));
		}, 250);
		return () => clearTimeout(handle);
	}, [state.assetType, state.query, state.selectedAsset]);

	function closeDialog() {
		if (mode === "create") setInternalOpen(false);
		else onClose?.();
	}

	function handleOpen() {
		setState(emptyState());
		setError(null);
		setParseWarning(null);
		setScraped(false);
		setConfirmedScrape(false);
		setInternalOpen(true);
	}

	function clearCertificate() {
		setState((s) => ({ ...s, certificate: null }));
		setParseWarning(null);
		setScraped(false);
		setConfirmedScrape(false);
	}

	async function handleCertificateSelected(file: File | null) {
		setState((s) => ({ ...s, certificate: file }));
		setParseWarning(null);
		setScraped(false);
		setConfirmedScrape(false);
		if (!file || !state.selectedAsset) return;

		setParsing(true);
		try {
			const result = await parseCertificate(state.selectedAsset.id, file);
			if (!result.recognized) {
				setParseWarning(
					result.reason ??
						"Couldn't automatically read this certificate -- enter the coefficients manually.",
				);
				return;
			}
			setState((s) => ({
				...s,
				facility: result.facility ?? s.facility,
				calDate: result.calDate ?? s.calDate,
				fields: {
					...s.fields,
					...Object.fromEntries(
						Object.entries(result.coefficients ?? {}).map(([k, v]) => [
							k,
							String(v),
						]),
					),
				},
			}));
			setScraped(true);
		} catch (err) {
			setParseWarning(
				err instanceof Error ? err.message : "Failed to read certificate.",
			);
		} finally {
			setParsing(false);
		}
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

		const serial = state.selectedAsset.serialNumber ?? state.selectedAsset.id;
		setSaving(true);
		try {
			if (mode === "edit" && row) {
				await updateCalibration(
					state.selectedAsset.id,
					row.id,
					{ calDate: state.calDate, coefficients },
					state.certificate ?? undefined,
				);
			} else {
				await recordCalibration(
					state.selectedAsset.id,
					{ calDate: state.calDate, coefficients },
					state.certificate ?? undefined,
				);
			}
			closeDialog();
			setBanner({
				severity: "success",
				message:
					mode === "edit"
						? `Calibration updated for SN ${serial}.`
						: `Calibration recorded for SN ${serial}.`,
			});
		} catch (err) {
			setBanner({
				severity: "error",
				message:
					err instanceof Error
						? err.message
						: `Failed to ${mode === "edit" ? "update" : "save"} calibration.`,
			});
		} finally {
			setSaving(false);
		}
	}

	function dismissBanner() {
		setBanner(null);
		router.refresh();
	}

	const coefficientFields = CAL_FIELDS[state.assetType] ?? [];
	const dialogTitle =
		mode === "edit"
			? `Edit calibration — SN ${row?.serialNumber ?? ""}`
			: "Add calibration coefficients";

	return (
		<>
			{mode === "create" && (
				<Button
					variant="contained"
					startIcon={<AddCircleOutlineIcon />}
					onClick={handleOpen}
				>
					Add calibration coefficients
				</Button>
			)}

			<Dialog open={open} onClose={closeDialog} maxWidth="sm" fullWidth>
				<DialogTitle>{dialogTitle}</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 2 }}
				>
					<TextField
						select
						size="small"
						label="Asset type"
						value={state.assetType}
						disabled={mode === "edit" || !!state.selectedAsset}
						onChange={(e) =>
							setState((s) => ({
								...emptyState(),
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
							{mode === "create" && (
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
							)}
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

					{(state.assetType === "ct_sensor" ||
						state.assetType === "do_sensor" ||
						state.assetType === "eco_sensor") && (
						<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
							<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
								<Button
									component="label"
									size="small"
									disabled={!state.selectedAsset || parsing}
								>
									Read in certificate
									<input
										type="file"
										accept="application/pdf"
										hidden
										onChange={(e) =>
											handleCertificateSelected(e.target.files?.[0] ?? null)
										}
									/>
								</Button>
								{parsing && <CircularProgress size={16} />}
								{state.certificate && !parsing && (
									<Button size="small" onClick={clearCertificate}>
										Remove
									</Button>
								)}
							</Box>
							{!state.selectedAsset && (
								<Typography variant="caption" color="text.disabled">
									Pick an asset above first.
								</Typography>
							)}
							{state.certificate && (
								<Typography variant="caption" color="text.secondary">
									{state.certificate.name}
								</Typography>
							)}
							{parseWarning && (
								<Alert severity="warning" sx={{ py: 0, fontSize: 12.5 }}>
									{parseWarning}
								</Alert>
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

					{scraped && (
						<FormControlLabel
							control={
								<Checkbox
									checked={confirmedScrape}
									onChange={(e) => setConfirmedScrape(e.target.checked)}
								/>
							}
							label={
								<Typography variant="body2">
									{SCRAPE_CONFIRMATION_LABEL}
								</Typography>
							}
						/>
					)}

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
					<Button
						variant="contained"
						onClick={handleSave}
						disabled={saving || (scraped && !confirmedScrape)}
					>
						{saving
							? "Saving…"
							: mode === "edit"
								? "Save changes"
								: "Save calibration"}
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
