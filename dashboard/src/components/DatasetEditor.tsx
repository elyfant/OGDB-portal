"use client";

import {
	applyDatasetStages,
	confirmErddapPush,
	createProcessingPackage,
	createProcessingPackageVersion,
	updateExternalReferences,
} from "@/lib/api-client";
import { formatDate } from "@/lib/format";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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
import IconButton from "@mui/material/IconButton";
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
	ErddapLevel,
	ErddapPushStatus,
	OgdbUser,
	ProcessingPackage,
	RecordDatasetStageInput,
} from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const STAGE_ORDER: DatasetProcessingStage[] = ["raw", "L0", "DM", "PUB"];
const STAGE_LABEL: Record<DatasetProcessingStage, string> = {
	raw: "Raw data archival",
	L0: "L0 dataset",
	DM: "Delayed mode dataset",
	PUB: "Published dataset",
};
// Sequential-ish progression through the pipeline, all drawn from MUI's own
// semantic palette so light/dark both work without hardcoded hex -- raw
// (nothing processed yet) gets no colour at all, only L0/DM/PUB do.
const STAGE_COLOR: Partial<
	Record<DatasetProcessingStage, "info" | "secondary" | "success">
> = {
	L0: "info",
	DM: "secondary",
	PUB: "success",
};
const QC_CAPABLE_STAGES: DatasetProcessingStage[] = ["DM", "PUB"];
// L0 is a raw-format conversion, not an OG1-eligible product -- only the
// delayed mode and published datasets can be OG1. See
// xxxx_dataset_processing_og1_check.py for the matching DB constraint.
const OG1_CAPABLE_STAGES: DatasetProcessingStage[] = ["DM", "PUB"];
const PROCESSING_NOTES_MAX = 5000;

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

interface StageFormState {
	// The explicit "save this to the DB" signal -- a diff against the
	// stored values isn't enough on its own, since sometimes the whole
	// point is to log a fresh run with identical values (e.g. re-confirming
	// QC on a rerun that produced the same result). See setRecording.
	recording: boolean;
	status: boolean;
	whoContactId: number | "";
	occurredAt: string;
	packageId: number | "";
	versionId: number | "";
	isOg1: boolean;
	// null = QC untouched for this run; true/false once the checkbox has
	// been set. No separate QC package/version/who/date -- see
	// DatasetProcessingStageDetail.qcDone.
	qcDone: boolean | null;
	processingNotes: string;
}

// Prefills every field from the stage's current row (not blanks/defaults),
// so turning "Record a new run" on reads as "amend this entry" rather than
// starting from blanks. Falls back to today/the current user only for a
// stage that's never been recorded at all.
function initialStageForm(
	detail: DatasetProcessingDetail,
	stage: DatasetProcessingStage,
	defaultContactId: number | "",
): StageFormState {
	const current = detail.stages.find((s) => s.stage === stage);
	return {
		recording: false,
		status: current?.status ?? false,
		whoContactId: current?.whoId ?? defaultContactId,
		occurredAt: current?.occurredAt ?? today(),
		packageId: current?.packageId ?? "",
		versionId: current?.versionId ?? "",
		isOg1: current?.isOg1 ?? false,
		qcDone: current?.qcDone ?? null,
		processingNotes: current?.processingNotes ?? "",
	};
}

function stageSummary(
	current: DatasetProcessingDetail["stages"][number] | undefined,
	hasQc: boolean,
): string {
	if (!current?.occurredAt) return "Not recorded yet";
	const who = current.who ?? "unknown";
	const status = current.status ? "Done" : "Not done";
	let text = `${formatDate(current.occurredAt)} · ${who} · ${status}`;
	if (hasQc) {
		text +=
			current.qcDone === null
				? " · No QC recorded"
				: current.qcDone
					? " · QC done"
					: " · QC not done";
	}
	return text;
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

// Confirms immediately on click (its own request), not batched into the
// main Save button -- "confirm this has been pushed" is a standalone
// action, not a draft field. Checked state is driven entirely by the
// `status` prop (current_erddap_status from the server), so a successful
// confirm + router.refresh() is what actually updates it -- no local
// mirror to go stale. Since status is a single value, checking either
// box always simply overwrites it -- checking "Published" can never
// leave "Delayed mode" also true, and vice versa.
function ErddapStatusControl({
	level,
	status,
	missionId,
	onError,
}: {
	level: ErddapLevel;
	status: ErddapPushStatus;
	missionId: number;
	onError: (message: string) => void;
}) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);

	async function confirm(next: ErddapPushStatus) {
		setBusy(true);
		try {
			await confirmErddapPush(missionId, { level, status: next });
			router.refresh();
		} catch (err) {
			onError(
				err instanceof Error ? err.message : "Failed to confirm ERDDAP push.",
			);
		} finally {
			setBusy(false);
		}
	}

	return (
		<Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
			<FormControlLabel
				sx={{ mr: 1 }}
				control={
					<Checkbox
						size="small"
						checked={status === "DM"}
						disabled={busy}
						onChange={(e) => confirm(e.target.checked ? "DM" : "none")}
					/>
				}
				label={
					<Typography variant="caption">Delayed mode pushed</Typography>
				}
			/>
			<FormControlLabel
				control={
					<Checkbox
						size="small"
						checked={status === "PUB"}
						disabled={busy}
						onChange={(e) => confirm(e.target.checked ? "PUB" : "none")}
					/>
				}
				label={<Typography variant="caption">Published pushed</Typography>}
			/>
		</Box>
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

	function buildStageForms(): Record<DatasetProcessingStage, StageFormState> {
		return Object.fromEntries(
			STAGE_ORDER.map((s) => [s, initialStageForm(detail, s, defaultContactId)]),
		) as Record<DatasetProcessingStage, StageFormState>;
	}

	// Frozen snapshot of what's currently saved, used only to detect which
	// stages actually changed at save time -- never written to directly by
	// the user, only re-synced (see the effect below) when fresh server
	// data arrives.
	const [initialStageForms, setInitialStageForms] = useState(buildStageForms);
	const [stageForms, setStageForms] =
		useState<Record<DatasetProcessingStage, StageFormState>>(buildStageForms);
	const [expandedStages, setExpandedStages] = useState<
		Record<DatasetProcessingStage, boolean>
	>(
		() =>
			Object.fromEntries(STAGE_ORDER.map((s) => [s, false])) as Record<
				DatasetProcessingStage,
				boolean
			>,
	);

	function toggleStage(stage: DatasetProcessingStage) {
		setExpandedStages((prev) => ({ ...prev, [stage]: !prev[stage] }));
	}

	const [doi, setDoi] = useState(detail.doi ?? "");
	const [erddapL1Url, setErddapL1Url] = useState(detail.erddapL1Url ?? "");
	const [erddapL2Url, setErddapL2Url] = useState(detail.erddapL2Url ?? "");
	const [oceanOpsBoardUrl, setOceanOpsBoardUrl] = useState(
		detail.oceanOpsBoardUrl ?? "",
	);
	const [coriolisUrl, setCoriolisUrl] = useState(detail.coriolisUrl ?? "");

	// The dialog never unmounts (only `open` toggles), so the useState
	// initializers above only ever run once, on first mount -- without
	// this, saving would successfully write to the DB, dismissSuccessBanner
	// would router.refresh() a fresh `detail` in, but `initialStageForms`
	// would still hold the pre-save baseline, so the just-saved stage would
	// permanently show as "unsaved" every time the modal is reopened.
	useEffect(() => {
		setStageForms(buildStageForms());
		setInitialStageForms(buildStageForms());
		setDoi(detail.doi ?? "");
		setErddapL1Url(detail.erddapL1Url ?? "");
		setErddapL2Url(detail.erddapL2Url ?? "");
		setOceanOpsBoardUrl(detail.oceanOpsBoardUrl ?? "");
		setCoriolisUrl(detail.coriolisUrl ?? "");
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [detail]);

	function updateStage(
		stage: DatasetProcessingStage,
		patch: Partial<StageFormState>,
	) {
		setStageForms((prev) => ({
			...prev,
			[stage]: { ...prev[stage], ...patch },
		}));
	}

	// Turning recording on keeps whatever's currently in the form (fields
	// are always prefilled/editable regardless of this toggle -- see the
	// expand/collapse chevron, which is independent of it), except
	// occurred-at, which jumps to today: flipping this switch on is itself
	// the "this is happening now" signal. Turning it back off discards
	// whatever was typed and reverts to the stored baseline, so no
	// half-edited state lingers invisibly if it's toggled on again later.
	function setRecording(stage: DatasetProcessingStage, value: boolean) {
		setStageForms((prev) => ({
			...prev,
			[stage]: value
				? { ...prev[stage], recording: true, occurredAt: today() }
				: { ...initialStageForms[stage], recording: false },
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
			const hasQc = QC_CAPABLE_STAGES.includes(stage);
			const hasOg1 = OG1_CAPABLE_STAGES.includes(stage);
			if (!form.recording) continue;
			if (!form.occurredAt) {
				setError(`${STAGE_LABEL[stage]}: pick an occurred-at date.`);
				return;
			}
			if (form.processingNotes.length > PROCESSING_NOTES_MAX) {
				setError(
					`${STAGE_LABEL[stage]}: processing notes can't exceed ${PROCESSING_NOTES_MAX} characters.`,
				);
				return;
			}
			stagesToRecord.push({
				stage,
				status: form.status,
				whoId: form.whoContactId || null,
				occurredAt: form.occurredAt,
				packageId: form.packageId || null,
				versionId: form.versionId || null,
				isOg1: hasOg1 ? form.isOg1 : null,
				qcDone: hasQc ? form.qcDone : null,
				processingNotes: form.processingNotes || null,
			});
			summaryLines.push(
				`${STAGE_LABEL[stage]}: recorded a new run (${form.status ? "done" : "not done"})`,
			);
		}

		const referencesChanged =
			doi !== (detail.doi ?? "") ||
			erddapL1Url !== (detail.erddapL1Url ?? "") ||
			erddapL2Url !== (detail.erddapL2Url ?? "") ||
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
					erddapL1Url,
					erddapL2Url,
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
					<Typography variant="caption" color="text.secondary">
						Data saved here will not overwrite previous entries in the
						dataset processing log — it only appends information.
					</Typography>
					{STAGE_ORDER.map((stage) => {
						const form = stageForms[stage];
						const color = STAGE_COLOR[stage];
						const hasQc = QC_CAPABLE_STAGES.includes(stage);
						const hasOg1 = OG1_CAPABLE_STAGES.includes(stage);
						const current = detail.stages.find((s) => s.stage === stage);
						const isExpanded = expandedStages[stage];
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
									flexShrink: 0,
								})}
							>
								<Box
									onClick={() => toggleStage(stage)}
									sx={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										px: 2,
										py: 1,
										cursor: "pointer",
										gap: 2,
									}}
								>
									<Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
										<Typography
											variant="subtitle2"
											sx={{
												fontWeight: 700,
												color: color ? `${color}.main` : "text.primary",
											}}
										>
											{STAGE_LABEL[stage]}
											{form.recording && (
												<Typography
													component="span"
													variant="caption"
													color="warning.main"
													sx={{ ml: 1, fontWeight: 700 }}
												>
													• recording new run
												</Typography>
											)}
										</Typography>
										<Typography variant="caption" color="text.secondary">
											{stageSummary(current, hasQc)}
										</Typography>
									</Box>
									<Box sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
										<Box
											onClick={(e) => e.stopPropagation()}
											sx={{ display: "flex", alignItems: "center" }}
										>
											<FormControlLabel
												sx={{ m: 0 }}
												control={
													<Switch
														size="small"
														checked={form.recording}
														onChange={(e) =>
															setRecording(stage, e.target.checked)
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
										<IconButton
											size="small"
											onClick={(e) => {
												e.stopPropagation();
												toggleStage(stage);
											}}
											sx={{
												transform: isExpanded ? "rotate(180deg)" : "none",
												transition: "transform 0.15s",
											}}
										>
											<ExpandMoreIcon fontSize="small" />
										</IconButton>
									</Box>
								</Box>

								{isExpanded && (
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
											<Box
												sx={{
													display: "flex",
													flexDirection: "column",
													gap: 0.25,
												}}
											>
												<FormControlLabel
													sx={{ m: 0 }}
													control={
														<Switch
															checked={form.status}
															onChange={(e) =>
																updateStage(stage, {
																	status: e.target.checked,
																})
															}
														/>
													}
													label={form.status ? "Done" : "Not done"}
												/>
												<Typography variant="caption" color="text.disabled">
													Drives the {STAGE_LABEL[stage]} tick on the mission
													list
												</Typography>
											</Box>
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
														md: hasOg1 ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
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
												{hasOg1 && (
													<Box
														sx={{
															display: "flex",
															flexDirection: "column",
															gap: 0.5,
															gridColumn: { xs: "1 / -1", md: "auto" },
														}}
													>
														<Typography
															variant="caption"
															sx={{ visibility: "hidden" }}
														>
															Package
														</Typography>
														<Box
															sx={{
																display: "flex",
																alignItems: "center",
																height: 40,
															}}
														>
															<FormControlLabel
																sx={{ m: 0 }}
																control={
																	<Checkbox
																		checked={form.isOg1}
																		onChange={(e) =>
																			updateStage(stage, {
																				isOg1: e.target.checked,
																			})
																		}
																	/>
																}
																label={
																	<Typography variant="body2">
																		OG1 format
																	</Typography>
																}
															/>
														</Box>
													</Box>
												)}
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
											<FormControlLabel
												sx={{ m: 0 }}
												control={
													<Checkbox
														checked={form.qcDone ?? false}
														onChange={(e) =>
															updateStage(stage, {
																qcDone: e.target.checked,
															})
														}
													/>
												}
												label={
													<Typography variant="body2">Manual QC</Typography>
												}
											/>
										)}

										{hasQc && (
											<Box
												sx={{
													display: "flex",
													flexDirection: "column",
													gap: 0.5,
												}}
											>
												<Typography variant="caption" color="text.secondary">
													Processing notes
												</Typography>
												<TextField
													multiline
													minRows={4}
													maxRows={12}
													fullWidth
													placeholder="Bounds/offsets used, skipped dives, known caveats, links to further docs…"
													value={form.processingNotes}
													onChange={(e) =>
														updateStage(stage, {
															processingNotes: e.target.value,
														})
													}
													error={
														form.processingNotes.length > PROCESSING_NOTES_MAX
													}
													helperText={`${form.processingNotes.length} / ${PROCESSING_NOTES_MAX}`}
													FormHelperTextProps={{
														sx: { textAlign: "right", m: 0, mt: 0.25 },
													}}
												/>
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
								label="Ocean Ops Board URL"
								value={oceanOpsBoardUrl}
								onChange={(e) => setOceanOpsBoardUrl(e.target.value)}
							/>
							<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
								<TextField
									size="small"
									label="NorGliders ERDDAP L1 (timeseries) URL"
									value={erddapL1Url}
									onChange={(e) => setErddapL1Url(e.target.value)}
								/>
								<ErddapStatusControl
									level="L1"
									status={detail.erddapL1Status}
									missionId={missionId}
									onError={setError}
								/>
							</Box>
							<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
								<TextField
									size="small"
									label="NorGliders ERDDAP L2 (gridded) URL"
									value={erddapL2Url}
									onChange={(e) => setErddapL2Url(e.target.value)}
								/>
								<ErddapStatusControl
									level="L2"
									status={detail.erddapL2Status}
									missionId={missionId}
									onError={setError}
								/>
							</Box>
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
