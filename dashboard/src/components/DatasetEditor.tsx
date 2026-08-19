"use client";

import {
	applyDatasetStages,
	createProcessingPackage,
	createProcessingPackageVersion,
	updateExternalReferences,
} from "@/lib/api-client";
import EditIcon from "@mui/icons-material/Edit";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Snackbar from "@mui/material/Snackbar";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type {
	DatasetProcessingDetail,
	DatasetProcessingStage,
	OgdbUser,
	ProcessingPackage,
	RecordDatasetStageInput,
} from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STAGE_ORDER: DatasetProcessingStage[] = ["raw", "L0", "L1", "L2"];
const STAGE_LABEL: Record<DatasetProcessingStage, string> = {
	raw: "Raw data archived",
	L0: "L0",
	L1: "L1 (timeseries)",
	L2: "L2 (gridded)",
};
// Sequential-ish progression through the pipeline, all drawn from MUI's own
// semantic palette so light/dark both work without hardcoded hex -- raw
// (nothing processed yet) gets no colour at all, only L0/L1/L2 do.
const STAGE_COLOR: Partial<
	Record<DatasetProcessingStage, "info" | "secondary" | "success">
> = {
	L0: "info",
	L1: "secondary",
	L2: "success",
};
const QC_CAPABLE_STAGES: DatasetProcessingStage[] = ["L1", "L2"];

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

interface QcFormState {
	removingErroneousData: boolean;
	offsetCorrection: boolean;
	despikingFiltering: boolean;
	qcWhoContactId: number | "";
	qcOccurredAt: string;
	qcPackageId: number | "";
	qcVersionId: number | "";
}

interface StageFormState {
	recording: boolean;
	status: boolean;
	whoContactId: number | "";
	occurredAt: string;
	packageId: number | "";
	versionId: number | "";
	isOg1: "" | "true" | "false";
	qc: QcFormState;
}

function emptyQc(): QcFormState {
	return {
		removingErroneousData: false,
		offsetCorrection: false,
		despikingFiltering: false,
		qcWhoContactId: "",
		qcOccurredAt: today(),
		qcPackageId: "",
		qcVersionId: "",
	};
}

function initialStageForm(
	detail: DatasetProcessingDetail,
	stage: DatasetProcessingStage,
	defaultContactId: number | "",
): StageFormState {
	const current = detail.stages.find((s) => s.stage === stage);
	return {
		recording: false,
		status: current?.status ?? false,
		whoContactId: defaultContactId,
		occurredAt: today(),
		packageId: current?.packageId ?? "",
		versionId: current?.versionId ?? "",
		isOg1:
			current?.isOg1 === true
				? "true"
				: current?.isOg1 === false
					? "false"
					: "",
		qc: current?.qc
			? {
					removingErroneousData: current.qc.removingErroneousData,
					offsetCorrection: current.qc.offsetCorrection,
					despikingFiltering: current.qc.despikingFiltering,
					qcWhoContactId: defaultContactId,
					qcOccurredAt: today(),
					qcPackageId: current.qc.packageId ?? "",
					qcVersionId: current.qc.versionId ?? "",
				}
			: emptyQc(),
	};
}

// Shared package -> version picker, used for both a stage's main
// package/version and its QC package/version. "+ Add new package" / "+ Add
// version" open a small inline create form in place of the select, same
// toggle-into-an-alternate-mode pattern as GliderBuildEditor's AssetPicker.
function PackageVersionFields({
	packages,
	packageId,
	versionId,
	onChangePackageId,
	onChangeVersionId,
	onPackageCreated,
	onVersionCreated,
}: {
	packages: ProcessingPackage[];
	packageId: number | "";
	versionId: number | "";
	onChangePackageId: (id: number | "") => void;
	onChangeVersionId: (id: number | "") => void;
	onPackageCreated: (pkg: ProcessingPackage) => void;
	onVersionCreated: (
		packageId: number,
		version: ProcessingPackage["versions"][number],
	) => void;
}) {
	const [addingPackage, setAddingPackage] = useState(false);
	const [newPackageName, setNewPackageName] = useState("");
	const [addingVersion, setAddingVersion] = useState(false);
	const [newVersionLabel, setNewVersionLabel] = useState("");
	const [newVersionUrl, setNewVersionUrl] = useState("");
	const [busy, setBusy] = useState(false);

	const selectedPackage = packages.find((p) => p.id === packageId);

	async function submitNewPackage() {
		if (!newPackageName.trim()) return;
		setBusy(true);
		try {
			const pkg = await createProcessingPackage({
				name: newPackageName.trim(),
			});
			onPackageCreated(pkg);
			onChangePackageId(pkg.id);
			onChangeVersionId("");
			setAddingPackage(false);
			setNewPackageName("");
		} finally {
			setBusy(false);
		}
	}

	async function submitNewVersion() {
		if (!newVersionLabel.trim() || !packageId) return;
		setBusy(true);
		try {
			const version = await createProcessingPackageVersion(packageId, {
				versionLabel: newVersionLabel.trim(),
				versionUrl: newVersionUrl || null,
			});
			onVersionCreated(packageId, version);
			onChangeVersionId(version.id);
			setAddingVersion(false);
			setNewVersionLabel("");
			setNewVersionUrl("");
		} finally {
			setBusy(false);
		}
	}

	return (
		<>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
				<Typography variant="caption" color="text.secondary">
					Package
				</Typography>
				{addingPackage ? (
					<Box sx={{ display: "flex", gap: 0.5 }}>
						<TextField
							size="small"
							autoFocus
							placeholder="New package name"
							value={newPackageName}
							onChange={(e) => setNewPackageName(e.target.value)}
							fullWidth
						/>
						<Button size="small" disabled={busy} onClick={submitNewPackage}>
							Add
						</Button>
						<Button size="small" onClick={() => setAddingPackage(false)}>
							Cancel
						</Button>
					</Box>
				) : (
					<Select
						size="small"
						fullWidth
						displayEmpty
						value={packageId}
						onChange={(e) => {
							if (e.target.value === "__new__") {
								setAddingPackage(true);
								return;
							}
							onChangePackageId(
								e.target.value === "" ? "" : Number(e.target.value),
							);
							onChangeVersionId("");
						}}
					>
						<MenuItem value="">— none —</MenuItem>
						{packages.map((p) => (
							<MenuItem key={p.id} value={p.id}>
								{p.name}
							</MenuItem>
						))}
						<MenuItem value="__new__" sx={{ color: "primary.main" }}>
							+ Add new package…
						</MenuItem>
					</Select>
				)}
			</Box>

			<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
				<Typography variant="caption" color="text.secondary">
					Version
				</Typography>
				{addingVersion ? (
					<Box sx={{ display: "flex", gap: 0.5 }}>
						<TextField
							size="small"
							autoFocus
							placeholder="Label, e.g. v0.6.2"
							value={newVersionLabel}
							onChange={(e) => setNewVersionLabel(e.target.value)}
						/>
						<TextField
							size="small"
							placeholder="URL (optional)"
							value={newVersionUrl}
							onChange={(e) => setNewVersionUrl(e.target.value)}
						/>
						<Button size="small" disabled={busy} onClick={submitNewVersion}>
							Add
						</Button>
						<Button size="small" onClick={() => setAddingVersion(false)}>
							Cancel
						</Button>
					</Box>
				) : (
					<Select
						size="small"
						fullWidth
						displayEmpty
						value={versionId}
						disabled={!packageId}
						onChange={(e) => {
							if (e.target.value === "__new__") {
								setAddingVersion(true);
								return;
							}
							onChangeVersionId(
								e.target.value === "" ? "" : Number(e.target.value),
							);
						}}
					>
						<MenuItem value="">— none —</MenuItem>
						{(selectedPackage?.versions ?? []).map((v) => (
							<MenuItem key={v.id} value={v.id}>
								{v.versionLabel}
							</MenuItem>
						))}
						{packageId && (
							<MenuItem value="__new__" sx={{ color: "primary.main" }}>
								+ Add version to {selectedPackage?.name}…
							</MenuItem>
						)}
					</Select>
				)}
			</Box>
		</>
	);
}

export default function DatasetEditor({
	missionId,
	detail,
	users,
	packages: initialPackages,
	currentUser,
}: {
	missionId: number;
	detail: DatasetProcessingDetail;
	users: OgdbUser[];
	packages: ProcessingPackage[];
	currentUser: { contactId: number | null; name: string } | null;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [successSummary, setSuccessSummary] = useState<string[] | null>(null);
	const [packages, setPackages] = useState(initialPackages);

	const defaultContactId = currentUser?.contactId ?? "";

	const [stageForms, setStageForms] = useState<
		Record<DatasetProcessingStage, StageFormState>
	>(
		() =>
			Object.fromEntries(
				STAGE_ORDER.map((s) => [
					s,
					initialStageForm(detail, s, defaultContactId),
				]),
			) as Record<DatasetProcessingStage, StageFormState>,
	);

	const [doi, setDoi] = useState(detail.doi ?? "");
	const [externalDataArchiveUrl, setExternalDataArchiveUrl] = useState(
		detail.externalDataArchiveUrl ?? "",
	);
	const [oceanOpsBoardUrl, setOceanOpsBoardUrl] = useState(
		detail.oceanOpsBoardUrl ?? "",
	);
	const [coriolisUrl, setCoriolisUrl] = useState(detail.coriolisUrl ?? "");

	function updateStage(
		stage: DatasetProcessingStage,
		patch: Partial<StageFormState>,
	) {
		setStageForms((prev) => ({
			...prev,
			[stage]: { ...prev[stage], ...patch },
		}));
	}

	function updateQc(
		stage: DatasetProcessingStage,
		patch: Partial<QcFormState>,
	) {
		setStageForms((prev) => ({
			...prev,
			[stage]: { ...prev[stage], qc: { ...prev[stage].qc, ...patch } },
		}));
	}

	function handlePackageCreated(pkg: ProcessingPackage) {
		setPackages((prev) =>
			[...prev, pkg].sort((a, b) => a.name.localeCompare(b.name)),
		);
	}

	function handleVersionCreated(
		packageId: number,
		version: ProcessingPackage["versions"][number],
	) {
		setPackages((prev) =>
			prev.map((p) =>
				p.id === packageId ? { ...p, versions: [...p.versions, version] } : p,
			),
		);
	}

	async function handleSave() {
		setError(null);

		const stagesToRecord: RecordDatasetStageInput[] = [];
		const summaryLines: string[] = [];
		for (const stage of STAGE_ORDER) {
			const form = stageForms[stage];
			if (!form.recording) continue;
			if (!form.occurredAt) {
				setError(`${STAGE_LABEL[stage]}: pick an occurred-at date.`);
				return;
			}
			stagesToRecord.push({
				stage,
				status: form.status,
				whoId: form.whoContactId || null,
				occurredAt: form.occurredAt,
				packageId: form.packageId || null,
				versionId: form.versionId || null,
				isOg1: form.isOg1 === "" ? null : form.isOg1 === "true",
				qc: QC_CAPABLE_STAGES.includes(stage)
					? {
							removingErroneousData: form.qc.removingErroneousData,
							offsetCorrection: form.qc.offsetCorrection,
							despikingFiltering: form.qc.despikingFiltering,
							qcWhoId: form.qc.qcWhoContactId || null,
							qcOccurredAt: form.qc.qcOccurredAt || null,
							qcPackageId: form.qc.qcPackageId || null,
							qcVersionId: form.qc.qcVersionId || null,
						}
					: null,
			});
			summaryLines.push(
				`${STAGE_LABEL[stage]}: recorded a new run (${form.status ? "done" : "not done"})`,
			);
		}

		const referencesChanged =
			doi !== (detail.doi ?? "") ||
			externalDataArchiveUrl !== (detail.externalDataArchiveUrl ?? "") ||
			oceanOpsBoardUrl !== (detail.oceanOpsBoardUrl ?? "") ||
			coriolisUrl !== (detail.coriolisUrl ?? "");

		if (stagesToRecord.length === 0 && !referencesChanged) {
			setError("No changes to save.");
			return;
		}

		setSaving(true);
		try {
			if (stagesToRecord.length > 0) {
				await applyDatasetStages(missionId, { stages: stagesToRecord });
			}
			if (referencesChanged) {
				await updateExternalReferences(missionId, {
					doi,
					externalDataArchiveUrl,
					oceanOpsBoardUrl,
					coriolisUrl,
				});
				summaryLines.push("External references updated");
			}
			setOpen(false);
			setSuccessSummary(summaryLines);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save changes.");
		} finally {
			setSaving(false);
		}
	}

	function dismissSuccessBanner() {
		setSuccessSummary(null);
		router.refresh();
	}

	return (
		<>
			<Button
				variant="contained"
				size="small"
				startIcon={<EditIcon fontSize="small" />}
				onClick={() => setOpen(true)}
			>
				Edit
			</Button>

			<Dialog
				open={open}
				onClose={() => setOpen(false)}
				maxWidth="md"
				fullWidth
			>
				<DialogTitle>Edit dataset — {detail.missionName}</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 2 }}
				>
					{STAGE_ORDER.map((stage) => {
						const form = stageForms[stage];
						const color = STAGE_COLOR[stage];
						const hasQc = QC_CAPABLE_STAGES.includes(stage);
						return (
							<Box
								key={stage}
								sx={(theme) => ({
									border: "1px solid",
									borderColor: color
										? alpha(theme.palette[color].main, 0.35)
										: "divider",
									bgcolor: color
										? alpha(theme.palette[color].main, 0.06)
										: "action.hover",
									borderRadius: 1,
									overflow: "hidden",
								})}
							>
								<Box
									sx={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										px: 2,
										py: 1,
									}}
								>
									<Typography
										variant="subtitle2"
										sx={{
											fontWeight: 700,
											color: color ? `${color}.main` : "text.primary",
										}}
									>
										{STAGE_LABEL[stage]}
									</Typography>
									<FormControlLabel
										sx={{ m: 0 }}
										control={
											<Switch
												size="small"
												checked={form.recording}
												onChange={(e) =>
													updateStage(stage, { recording: e.target.checked })
												}
											/>
										}
										label={
											<Typography variant="caption">
												Record a new run
											</Typography>
										}
										labelPlacement="start"
									/>
								</Box>

								{form.recording && (
									<Box
										sx={{
											bgcolor: "background.paper",
											m: 1,
											borderRadius: 1,
											p: 2,
											display: "flex",
											flexDirection: "column",
											gap: 2,
										}}
									>
										<Box
											sx={{
												display: "grid",
												gridTemplateColumns: {
													xs: "1fr 1fr",
													md: "repeat(3, 1fr)",
												},
												gap: 2,
											}}
										>
											<FormControlLabel
												control={
													<Switch
														checked={form.status}
														onChange={(e) =>
															updateStage(stage, { status: e.target.checked })
														}
													/>
												}
												label={form.status ? "Done" : "Not done"}
											/>
											<Box
												sx={{
													display: "flex",
													flexDirection: "column",
													gap: 0.5,
												}}
											>
												<Typography variant="caption" color="text.secondary">
													Who
												</Typography>
												<Select
													size="small"
													fullWidth
													displayEmpty
													value={form.whoContactId}
													onChange={(e) =>
														updateStage(stage, {
															whoContactId:
																e.target.value === ""
																	? ""
																	: Number(e.target.value),
														})
													}
												>
													<MenuItem value="">— unset —</MenuItem>
													{users.map((u) => (
														<MenuItem key={u.contactId} value={u.contactId}>
															{u.name}
															{u.contactId === currentUser?.contactId
																? " (you)"
																: ""}
														</MenuItem>
													))}
												</Select>
											</Box>
											<Box
												sx={{
													display: "flex",
													flexDirection: "column",
													gap: 0.5,
												}}
											>
												<Typography variant="caption" color="text.secondary">
													Occurred at
												</Typography>
												<TextField
													size="small"
													type="date"
													fullWidth
													value={form.occurredAt}
													onChange={(e) =>
														updateStage(stage, { occurredAt: e.target.value })
													}
												/>
											</Box>
										</Box>

										{stage !== "raw" && (
											<Box
												sx={{
													display: "grid",
													gridTemplateColumns: {
														xs: "1fr 1fr",
														md: "repeat(3, 1fr)",
													},
													gap: 2,
													alignItems: "start",
												}}
											>
												<PackageVersionFields
													packages={packages}
													packageId={form.packageId}
													versionId={form.versionId}
													onChangePackageId={(id) =>
														updateStage(stage, { packageId: id })
													}
													onChangeVersionId={(id) =>
														updateStage(stage, { versionId: id })
													}
													onPackageCreated={handlePackageCreated}
													onVersionCreated={handleVersionCreated}
												/>
												<Box
													sx={{
														display: "flex",
														flexDirection: "column",
														gap: 0.5,
													}}
												>
													<Typography variant="caption" color="text.secondary">
														OG1
													</Typography>
													<Select
														size="small"
														fullWidth
														value={form.isOg1}
														onChange={(e) =>
															updateStage(stage, {
																isOg1: e.target
																	.value as StageFormState["isOg1"],
															})
														}
													>
														<MenuItem value="">Pending</MenuItem>
														<MenuItem value="true">Yes</MenuItem>
														<MenuItem value="false">No</MenuItem>
													</Select>
												</Box>
											</Box>
										)}

										{stage !== "raw" && (
											<Box sx={{ display: "flex", gap: 3 }}>
												<Typography variant="caption" color="text.disabled">
													Internal download:{" "}
													{detail.stages.find((s) => s.stage === stage)
														?.hasInternalDownload
														? "available"
														: "not available"}{" "}
													(read-only until file storage is decided)
												</Typography>
											</Box>
										)}

										{hasQc && (
											<Box
												sx={{
													border: "1px dashed",
													borderColor: "divider",
													borderRadius: 1,
													p: 1.5,
													display: "flex",
													flexDirection: "column",
													gap: 1.5,
												}}
											>
												<Typography
													variant="caption"
													sx={{ fontWeight: 700, textTransform: "uppercase" }}
												>
													Manual QC
												</Typography>
												<Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
													<FormControlLabel
														control={
															<Checkbox
																size="small"
																checked={form.qc.removingErroneousData}
																onChange={(e) =>
																	updateQc(stage, {
																		removingErroneousData: e.target.checked,
																	})
																}
															/>
														}
														label={
															<Typography variant="body2">
																Removing erroneous data
															</Typography>
														}
													/>
													<FormControlLabel
														control={
															<Checkbox
																size="small"
																checked={form.qc.offsetCorrection}
																onChange={(e) =>
																	updateQc(stage, {
																		offsetCorrection: e.target.checked,
																	})
																}
															/>
														}
														label={
															<Typography variant="body2">
																Offset correction (ship CTD)
															</Typography>
														}
													/>
													<FormControlLabel
														control={
															<Checkbox
																size="small"
																checked={form.qc.despikingFiltering}
																onChange={(e) =>
																	updateQc(stage, {
																		despikingFiltering: e.target.checked,
																	})
																}
															/>
														}
														label={
															<Typography variant="body2">
																Despiking / filtering
															</Typography>
														}
													/>
												</Box>
												<Box
													sx={{
														display: "grid",
														gridTemplateColumns: {
															xs: "1fr 1fr",
															md: "repeat(4, 1fr)",
														},
														gap: 2,
													}}
												>
													<PackageVersionFields
														packages={packages}
														packageId={form.qc.qcPackageId}
														versionId={form.qc.qcVersionId}
														onChangePackageId={(id) =>
															updateQc(stage, { qcPackageId: id })
														}
														onChangeVersionId={(id) =>
															updateQc(stage, { qcVersionId: id })
														}
														onPackageCreated={handlePackageCreated}
														onVersionCreated={handleVersionCreated}
													/>
													<Box
														sx={{
															display: "flex",
															flexDirection: "column",
															gap: 0.5,
														}}
													>
														<Typography
															variant="caption"
															color="text.secondary"
														>
															QC who
														</Typography>
														<Select
															size="small"
															fullWidth
															displayEmpty
															value={form.qc.qcWhoContactId}
															onChange={(e) =>
																updateQc(stage, {
																	qcWhoContactId:
																		e.target.value === ""
																			? ""
																			: Number(e.target.value),
																})
															}
														>
															<MenuItem value="">— unset —</MenuItem>
															{users.map((u) => (
																<MenuItem key={u.contactId} value={u.contactId}>
																	{u.name}
																</MenuItem>
															))}
														</Select>
													</Box>
													<Box
														sx={{
															display: "flex",
															flexDirection: "column",
															gap: 0.5,
														}}
													>
														<Typography
															variant="caption"
															color="text.secondary"
														>
															QC occurred at
														</Typography>
														<TextField
															size="small"
															type="date"
															fullWidth
															value={form.qc.qcOccurredAt}
															onChange={(e) =>
																updateQc(stage, {
																	qcOccurredAt: e.target.value,
																})
															}
														/>
													</Box>
												</Box>
											</Box>
										)}
									</Box>
								)}
							</Box>
						);
					})}

					<Box
						sx={{
							border: "1px solid",
							borderColor: "divider",
							borderRadius: 1,
							p: 2,
							display: "flex",
							flexDirection: "column",
							gap: 2,
						}}
					>
						<Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
							External references
						</Typography>
						<Box
							sx={{
								display: "grid",
								gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
								gap: 2,
							}}
						>
							<TextField
								size="small"
								label="DOI"
								value={doi}
								onChange={(e) => setDoi(e.target.value)}
							/>
							<TextField
								size="small"
								label="External data archive URL"
								value={externalDataArchiveUrl}
								onChange={(e) => setExternalDataArchiveUrl(e.target.value)}
							/>
							<TextField
								size="small"
								label="Ocean Ops Board URL"
								value={oceanOpsBoardUrl}
								onChange={(e) => setOceanOpsBoardUrl(e.target.value)}
							/>
							<TextField
								size="small"
								label="Coriolis URL"
								value={coriolisUrl}
								onChange={(e) => setCoriolisUrl(e.target.value)}
							/>
						</Box>
					</Box>

					{error && (
						<Typography color="error" variant="body2">
							{error}
						</Typography>
					)}
				</DialogContent>
				<DialogActions sx={{ px: 3, py: 1.5 }}>
					<Button onClick={() => setOpen(false)} disabled={saving}>
						Cancel
					</Button>
					<Button variant="contained" onClick={handleSave} disabled={saving}>
						{saving ? "Saving…" : "Save changes"}
					</Button>
				</DialogActions>
			</Dialog>

			<Snackbar
				open={successSummary !== null}
				onClose={dismissSuccessBanner}
				anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
			>
				<Alert
					severity="success"
					variant="filled"
					sx={{ maxWidth: 480 }}
					action={
						<Button color="inherit" size="small" onClick={dismissSuccessBanner}>
							OK
						</Button>
					}
				>
					<AlertTitle>Dataset updated</AlertTitle>
					{successSummary?.map((line) => (
						<Typography key={line} variant="body2">
							{line}
						</Typography>
					))}
				</Alert>
			</Snackbar>
		</>
	);
}
