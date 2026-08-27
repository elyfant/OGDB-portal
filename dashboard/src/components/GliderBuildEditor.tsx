"use client";

import { applyBuildChanges, searchAssets } from "@/lib/api-client";
import { formatAssetType } from "@/lib/format";
import EditIcon from "@mui/icons-material/Edit";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Snackbar from "@mui/material/Snackbar";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import type {
	AssetSearchResult,
	AssetStatusOption,
	BuildChange,
	GliderBuildComponent,
} from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const GROUP_ORDER = ["structural", "power", "sensor", "tracking"];
const GROUP_LABEL: Record<string, string> = {
	structural: "Structural",
	power: "Power",
	sensor: "Science sensors",
	tracking: "Tracking",
};

// Science-sensor asset types -- the "sensor" asset_type_group.
const SCIENCE_ASSET_TYPES = new Set([
	"ct_sensor",
	"do_sensor",
	"eco_sensor",
	"mr_sensor",
]);

const ALL_ASSET_TYPES = [
	"slocum_aft_section",
	"slocum_forward_section",
	"slocum_end_cap",
	"slocum_payload_bay",
	"slocum_hull",
	"slocum_altimeter",
	"slocum_energy_bay",
	"slocum_thruster",
	"battery",
	"ct_sensor",
	"do_sensor",
	"eco_sensor",
	"mr_sensor",
	"argos_tag",
	"nose_cone",
];

// Two disjoint "add a component" dropdowns off one canonical list: the
// glider-build editor manages everything except science sensors, the
// science-payload editor manages only science sensors.
const BUILD_ASSET_TYPES = ALL_ASSET_TYPES.filter(
	(t) => !SCIENCE_ASSET_TYPES.has(t),
);
const SCIENCE_SENSOR_TYPES = ALL_ASSET_TYPES.filter((t) =>
	SCIENCE_ASSET_TYPES.has(t),
);

type RowAction = "keep" | "replace" | "remove";

interface PickerState {
	mode: "existing" | "new";
	query: string;
	results: AssetSearchResult[];
	selectedId: number | null;
	// Snapshot of the selected result's display text, captured at selection
	// time -- lets the picker show what's selected without depending on
	// `results` still containing it (a later search could replace that list).
	selectedLabel: string | null;
	newSerial: string;
	newModel: string;
}

interface RowState {
	action: RowAction;
	picker: PickerState;
	statusId: number | "";
	statusNotes: string;
}

interface AdditionState {
	id: number;
	assetType: string;
	parentAssetId: number;
	position: string;
	picker: PickerState;
}

function emptyPicker(): PickerState {
	return {
		mode: "existing",
		query: "",
		results: [],
		selectedId: null,
		selectedLabel: null,
		newSerial: "",
		newModel: "",
	};
}

function resultLabel(r: AssetSearchResult): string {
	return `SN ${r.serialNumber ?? "—"} · ${r.model ?? "—"}`;
}

function emptyRow(): RowState {
	return {
		action: "keep",
		picker: emptyPicker(),
		statusId: "",
		statusNotes: "",
	};
}

// Debounced search-by-serial, scoped to one asset type at a time --
// shared by every Replace panel and every Addition row.
function AssetPicker({
	assetType,
	picker,
	onChange,
}: {
	assetType: string;
	picker: PickerState;
	onChange: (next: PickerState) => void;
}) {
	// biome-ignore lint/correctness/useExhaustiveDependencies: onChange/picker deliberately omitted -- a fresh onChange closure each render would re-fire the debounce every keystroke
	useEffect(() => {
		if (picker.mode !== "existing") return;
		const handle = setTimeout(() => {
			searchAssets(assetType, picker.query)
				.then((results) => onChange({ ...picker, results }))
				.catch(() => onChange({ ...picker, results: [] }));
		}, 250);
		return () => clearTimeout(handle);
	}, [assetType, picker.query, picker.mode]);

	if (picker.mode === "new") {
		return (
			<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
				<Box sx={{ display: "flex", gap: 1 }}>
					<TextField
						size="small"
						label="Serial number"
						value={picker.newSerial}
						onChange={(e) => onChange({ ...picker, newSerial: e.target.value })}
					/>
					<TextField
						size="small"
						label="Model (optional)"
						value={picker.newModel}
						onChange={(e) => onChange({ ...picker, newModel: e.target.value })}
					/>
				</Box>
				<Button
					size="small"
					onClick={() => onChange({ ...picker, mode: "existing" })}
				>
					Search existing instead
				</Button>
			</Box>
		);
	}

	if (picker.selectedId) {
		return (
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
					bgcolor: "background.paper",
				}}
			>
				<span style={{ fontFamily: "monospace", fontSize: 13 }}>
					{picker.selectedLabel}
				</span>
				<Button
					size="small"
					onClick={() =>
						onChange({
							...picker,
							selectedId: null,
							selectedLabel: null,
							query: "",
							results: [],
						})
					}
				>
					Change
				</Button>
			</Box>
		);
	}

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
			<TextField
				size="small"
				placeholder="Search by serial number…"
				value={picker.query}
				onChange={(e) =>
					onChange({ ...picker, query: e.target.value, selectedId: null })
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
				{picker.results.map((r) => (
					<Box
						key={r.id}
						onClick={() =>
							onChange({
								...picker,
								selectedId: r.id,
								selectedLabel: resultLabel(r),
							})
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
				{picker.results.length === 0 && (
					<Typography
						variant="body2"
						color="text.disabled"
						sx={{ px: 1.25, py: 0.75 }}
					>
						No matches.
					</Typography>
				)}
			</Box>
			<Button size="small" onClick={() => onChange({ ...picker, mode: "new" })}>
				+ New asset instead
			</Button>
		</Box>
	);
}

export default function GliderBuildEditor({
	gliderId,
	components,
	statusOptions,
	missionId,
	defaultDate,
	variant = "build",
	triggerLabel,
}: {
	gliderId: number;
	components: GliderBuildComponent[];
	statusOptions: AssetStatusOption[];
	missionId?: number;
	defaultDate?: string;
	// "build" -> everything except science sensors; "science" -> only the
	// science sensors. Same dialog, disjoint asset-type scope.
	variant?: "build" | "science";
	triggerLabel?: string;
}) {
	const isScience = variant === "science";
	const addableTypes = isScience ? SCIENCE_SENSOR_TYPES : BUILD_ASSET_TYPES;
	const dialogTitle = isScience ? "Edit science payload" : "Edit build";
	const resolvedTriggerLabel =
		triggerLabel ?? (isScience ? "Edit science payload" : "Edit glider build");
	const addRowLabel = isScience
		? "+ Add a science sensor"
		: "+ Add a component that isn't replacing anything";
	// The dialog only ever touches assignments it renders -- scope the
	// component list so the science editor can't reach structural/power rows
	// (and vice versa).
	const scopedComponents = isScience
		? components.filter((c) => SCIENCE_ASSET_TYPES.has(c.assetType))
		: components.filter((c) => !SCIENCE_ASSET_TYPES.has(c.assetType));

	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [effectiveDate, setEffectiveDate] = useState(defaultDate ?? "");
	const [notes, setNotes] = useState("");
	const [rows, setRows] = useState<Record<number, RowState>>({});
	const [additions, setAdditions] = useState<AdditionState[]>([]);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [nextAdditionId, setNextAdditionId] = useState(1);
	const [successSummary, setSuccessSummary] = useState<string[] | null>(null);

	function describePicked(picker: PickerState): string {
		if (picker.mode === "existing") {
			return picker.selectedLabel ?? `asset #${picker.selectedId}`;
		}
		return `new SN ${picker.newSerial}${picker.newModel ? ` · ${picker.newModel}` : ""}`;
	}

	function statusLabel(statusId: number | ""): string | null {
		if (!statusId) return null;
		const option = statusOptions.find((o) => o.id === statusId);
		return option ? option.description || option.name : null;
	}

	function dismissSuccessBanner() {
		setSuccessSummary(null);
		router.refresh();
	}

	function rowFor(assignmentId: number): RowState {
		return rows[assignmentId] ?? emptyRow();
	}

	function updateRow(assignmentId: number, patch: Partial<RowState>) {
		setRows((r) => ({
			...r,
			[assignmentId]: { ...rowFor(assignmentId), ...patch },
		}));
	}

	function addAddition() {
		setAdditions((a) => [
			...a,
			{
				id: nextAdditionId,
				assetType: addableTypes[0],
				parentAssetId: gliderId,
				position: "",
				picker: emptyPicker(),
			},
		]);
		setNextAdditionId((n) => n + 1);
	}

	function updateAddition(id: number, patch: Partial<AdditionState>) {
		setAdditions((list) =>
			list.map((a) => (a.id === id ? { ...a, ...patch } : a)),
		);
	}

	function removeAddition(id: number) {
		setAdditions((list) => list.filter((a) => a.id !== id));
	}

	const groups = GROUP_ORDER.map((group) => ({
		group,
		items: scopedComponents.filter((c) => c.assetTypeGroup === group),
	})).filter((g) => g.items.length > 0);

	const changedCount = Object.values(rows).filter(
		(r) => r.action !== "keep",
	).length;

	async function handleSave() {
		setError(null);
		if (!effectiveDate) {
			setError("Pick an effective date.");
			return;
		}

		const changes: BuildChange[] = [];
		const summaryLines: string[] = [];
		for (const c of scopedComponents) {
			const row = rowFor(c.assignmentId);
			const label = `${formatAssetType(c.assetType)}${c.position ? ` (${c.position})` : ""}`;
			if (row.action === "replace") {
				if (row.picker.mode === "existing" && !row.picker.selectedId) {
					setError(
						`Pick a replacement for ${formatAssetType(c.assetType)}, or switch it back to Unchanged.`,
					);
					return;
				}
				if (row.picker.mode === "new" && !row.picker.newSerial) {
					setError(
						`Enter a serial number for the new ${formatAssetType(c.assetType)}.`,
					);
					return;
				}
				changes.push({
					action: "replace",
					assignmentId: c.assignmentId,
					childAssetId:
						row.picker.mode === "existing"
							? (row.picker.selectedId ?? undefined)
							: undefined,
					newAsset:
						row.picker.mode === "new"
							? {
									assetType: c.assetType,
									serialNumber: row.picker.newSerial,
									model: row.picker.newModel || null,
								}
							: undefined,
				});
				summaryLines.push(
					`Replaced ${label}: SN ${c.serialNumber ?? "—"} → ${describePicked(row.picker)}`,
				);
			} else if (row.action === "remove") {
				changes.push({
					action: "remove",
					assignmentId: c.assignmentId,
					newStatusId: row.statusId || null,
					statusNotes: row.statusNotes || null,
				});
				const status = statusLabel(row.statusId);
				summaryLines.push(
					`Removed ${label}: SN ${c.serialNumber ?? "—"}${status ? `, status set to ${status}` : ""}`,
				);
			}
		}
		for (const add of additions) {
			if (add.picker.mode === "existing" && !add.picker.selectedId) {
				setError(
					"Pick an asset for the new component, or switch it to + New asset.",
				);
				return;
			}
			if (add.picker.mode === "new" && !add.picker.newSerial) {
				setError("Enter a serial number for the new component.");
				return;
			}
			changes.push({
				action: "add",
				parentAssetId: add.parentAssetId,
				position: add.position || null,
				childAssetId:
					add.picker.mode === "existing"
						? (add.picker.selectedId ?? undefined)
						: undefined,
				newAsset:
					add.picker.mode === "new"
						? {
								assetType: add.assetType,
								serialNumber: add.picker.newSerial,
								model: add.picker.newModel || null,
							}
						: undefined,
			});
			const addLabel = `${formatAssetType(add.assetType)}${add.position ? ` (${add.position})` : ""}`;
			summaryLines.push(`Added ${addLabel}: ${describePicked(add.picker)}`);
		}

		if (changes.length === 0) {
			setError("No changes to save.");
			return;
		}

		setSaving(true);
		try {
			await applyBuildChanges(gliderId, {
				effectiveDate,
				missionId: missionId ?? null,
				notes: notes || null,
				changes,
			});
			setOpen(false);
			setRows({});
			setAdditions([]);
			setNotes("");
			// router.refresh() waits until the banner is dismissed -- doing it
			// immediately risks the refresh swapping out this component (or
			// falling back to a full navigation on a failed RSC fetch) before
			// the user ever sees the summary.
			setSuccessSummary(summaryLines);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save changes.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			<Button
				variant="contained"
				size="small"
				startIcon={<EditIcon fontSize="small" />}
				onClick={() => setOpen(true)}
			>
				{resolvedTriggerLabel}
			</Button>

			<Dialog
				open={open}
				onClose={() => setOpen(false)}
				maxWidth="sm"
				fullWidth
			>
				<DialogTitle>{dialogTitle}</DialogTitle>
				<DialogContent dividers>
					<Box sx={{ display: "flex", alignItems: "center", gap: 3, mb: 3 }}>
						<TextField
							type="date"
							size="small"
							label="Effective date"
							value={effectiveDate}
							onChange={(e) => setEffectiveDate(e.target.value)}
							disabled={!!missionId}
							InputLabelProps={{ shrink: true }}
						/>
						{missionId && (
							<Chip
								size="small"
								label={`Linked to mission #${missionId}`}
								color="info"
							/>
						)}
					</Box>

					{groups.map(({ group, items }) => (
						<Box key={group} sx={{ mb: 2.5 }}>
							<Typography
								variant="overline"
								sx={{ color: "text.secondary", letterSpacing: 1 }}
							>
								{GROUP_LABEL[group]}
							</Typography>
							{items.map((c) => {
								const row = rowFor(c.assignmentId);
								return (
									<Box
										key={c.assignmentId}
										sx={{
											borderTop: "1px solid",
											borderColor: "divider",
											py: 1.25,
										}}
									>
										<Box
											sx={{
												display: "flex",
												alignItems: "center",
												justifyContent: "space-between",
												gap: 2,
											}}
										>
											<Box>
												<Typography variant="body2" sx={{ fontWeight: 500 }}>
													{formatAssetType(c.assetType)}
													{c.position ? ` (${c.position})` : ""}
												</Typography>
												<Typography
													variant="caption"
													color="text.secondary"
													sx={{ fontFamily: "monospace" }}
												>
													SN {c.serialNumber ?? "—"}{" "}
													{c.model ? `· ${c.model}` : ""}
												</Typography>
											</Box>
											<ToggleButtonGroup
												size="small"
												exclusive
												value={row.action}
												onChange={(_, value) =>
													value && updateRow(c.assignmentId, { action: value })
												}
											>
												<ToggleButton value="keep" color="success">
													Unchanged
												</ToggleButton>
												<ToggleButton value="replace" color="warning">
													Replace
												</ToggleButton>
												<ToggleButton value="remove" color="error">
													Remove
												</ToggleButton>
											</ToggleButtonGroup>
										</Box>

										{row.action === "replace" && (
											<Box
												sx={(theme) => ({
													mt: 1.5,
													p: 1.5,
													bgcolor: alpha(theme.palette.warning.main, 0.12),
													border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
													borderRadius: 1,
												})}
											>
												<Typography
													variant="caption"
													sx={{
														display: "block",
														mb: 1,
														fontWeight: 600,
														color: "warning.main",
													}}
												>
													Replace with — {formatAssetType(c.assetType)}
													{c.position ? `, ${c.position} position` : ""}
												</Typography>
												<AssetPicker
													assetType={c.assetType}
													picker={row.picker}
													onChange={(picker) =>
														updateRow(c.assignmentId, { picker })
													}
												/>
											</Box>
										)}

										{row.action === "remove" && (
											<Box
												sx={(theme) => ({
													mt: 1.5,
													p: 1.5,
													bgcolor: alpha(theme.palette.error.main, 0.12),
													border: `1px solid ${alpha(theme.palette.error.main, 0.35)}`,
													borderRadius: 1,
													display: "flex",
													flexDirection: "column",
													gap: 1,
												})}
											>
												<Typography
													variant="caption"
													sx={{ fontWeight: 600, color: "error.main" }}
												>
													Removed, no replacement
												</Typography>
												<Typography variant="caption" color="error.main">
													Closes this assignment on{" "}
													{effectiveDate || "the effective date"} — nothing new
													opens.
												</Typography>
												<Box
													sx={{ display: "flex", alignItems: "center", gap: 1 }}
												>
													<Typography
														variant="caption"
														color="error.main"
														sx={{ whiteSpace: "nowrap" }}
													>
														Set status to
													</Typography>
													<Select
														size="small"
														value={row.statusId}
														onChange={(e) =>
															updateRow(c.assignmentId, {
																statusId: Number(e.target.value) || "",
															})
														}
														displayEmpty
														sx={{ flex: 1, bgcolor: "background.paper" }}
													>
														<MenuItem value="">— leave unset —</MenuItem>
														{statusOptions.map((o) => (
															<MenuItem key={o.id} value={o.id}>
																{o.description || o.name}
															</MenuItem>
														))}
													</Select>
												</Box>
											</Box>
										)}
									</Box>
								);
							})}
						</Box>
					))}

					{additions.map((add) => (
						<Box
							key={add.id}
							sx={{
								border: "1px dashed",
								borderColor: "divider",
								borderRadius: 1,
								p: 1.5,
								mb: 1.5,
							}}
						>
							<Box sx={{ display: "flex", gap: 1, mb: 1 }}>
								<Select
									size="small"
									value={add.assetType}
									onChange={(e) =>
										updateAddition(add.id, { assetType: e.target.value })
									}
									sx={{ flex: 1 }}
								>
									{addableTypes.map((t) => (
										<MenuItem key={t} value={t}>
											{formatAssetType(t)}
										</MenuItem>
									))}
								</Select>
								<TextField
									size="small"
									label="Position (optional)"
									value={add.position}
									onChange={(e) =>
										updateAddition(add.id, { position: e.target.value })
									}
								/>
								<Button
									size="small"
									color="error"
									onClick={() => removeAddition(add.id)}
								>
									Remove
								</Button>
							</Box>
							<AssetPicker
								assetType={add.assetType}
								picker={add.picker}
								onChange={(picker) => updateAddition(add.id, { picker })}
							/>
						</Box>
					))}

					<Button size="small" onClick={addAddition} sx={{ mb: 2 }}>
						{addRowLabel}
					</Button>

					<TextField
						fullWidth
						multiline
						minRows={2}
						size="small"
						label="Notes (optional)"
						placeholder="Context for this batch of changes"
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
					/>

					{error && (
						<Typography color="error" variant="body2" sx={{ mt: 2 }}>
							{error}
						</Typography>
					)}
				</DialogContent>
				<DialogActions sx={{ justifyContent: "space-between", px: 3, py: 1.5 }}>
					<Typography variant="caption" color="text.secondary">
						{changedCount} changed, {additions.length} added
					</Typography>
					<Box sx={{ display: "flex", gap: 1 }}>
						<Button onClick={() => setOpen(false)} disabled={saving}>
							Cancel
						</Button>
						<Button variant="contained" onClick={handleSave} disabled={saving}>
							{saving ? "Saving…" : "Save changes"}
						</Button>
					</Box>
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
					<AlertTitle>Build updated</AlertTitle>
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
