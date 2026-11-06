"use client";

import {
	createMission,
	getGliderBuildClient,
	searchAssets,
	updateMission,
} from "@/lib/api-client";
import { formatAssetType } from "@/lib/format";
import { previewMissionName } from "@/lib/mission-name";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Snackbar from "@mui/material/Snackbar";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type {
	AssetSearchResult,
	BuildChange,
	Cruise,
	Glider,
	GliderBuildComponent,
	LookupOption,
	Mission,
} from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface FormState {
	missionNumber: string;
	gliderAssetId: number | "";
	statusId: number | "";
	projectId: number | "";
	siteId: number | "";
	principalInvestigatorId: number | "";
	technicalLeadId: number | "";
	operatingAgencyId: number | "";
	fundingAgencyId: number | "";
	launchDate: string;
	launchLatitude: string;
	launchLongitude: string;
	launchCruiseId: number | "";
	endDateScience: string;
	recoveryDate: string;
	recoveryLatitude: string;
	recoveryLongitude: string;
	recoveryCruiseId: number | "";
	volume: string;
	weightInAir: string;
	density: string;
	dives: string;
	distanceKm: string;
	iridiumMinutes: string;
}

function emptyForm(): FormState {
	return {
		missionNumber: "",
		gliderAssetId: "",
		statusId: "",
		projectId: "",
		siteId: "",
		principalInvestigatorId: "",
		technicalLeadId: "",
		operatingAgencyId: "",
		fundingAgencyId: "",
		launchDate: "",
		launchLatitude: "",
		launchLongitude: "",
		launchCruiseId: "",
		endDateScience: "",
		recoveryDate: "",
		recoveryLatitude: "",
		recoveryLongitude: "",
		recoveryCruiseId: "",
		volume: "",
		weightInAir: "",
		density: "",
		dives: "",
		distanceKm: "",
		iridiumMinutes: "",
	};
}

// Seeds every field straight from an existing mission's raw values --
// the same fields SELECT_MISSIONS already exposes as FK ids (added for
// the Add Mission dialog's autopopulate feature), reused here for the
// same reason: setting a real dropdown selection needs the id, not the
// resolved display string.
function formFromMission(m: Mission): FormState {
	return {
		missionNumber: m.missionNumber?.toString() ?? "",
		gliderAssetId: m.gliderAssetId ?? "",
		statusId: m.statusId ?? "",
		projectId: m.projectId ?? "",
		siteId: m.siteId ?? "",
		principalInvestigatorId: m.principalInvestigatorId ?? "",
		technicalLeadId: m.technicalLeadId ?? "",
		operatingAgencyId: m.operatingAgencyId ?? "",
		fundingAgencyId: m.fundingAgencyId ?? "",
		launchDate: m.launchDate?.slice(0, 10) ?? "",
		launchLatitude: m.launchLatitude?.toString() ?? "",
		launchLongitude: m.launchLongitude?.toString() ?? "",
		launchCruiseId: m.launchCruiseId ?? "",
		endDateScience: m.endDateScience?.slice(0, 10) ?? "",
		recoveryDate: m.recoveryDate?.slice(0, 10) ?? "",
		recoveryLatitude: m.recoveryLatitude?.toString() ?? "",
		recoveryLongitude: m.recoveryLongitude?.toString() ?? "",
		recoveryCruiseId: m.recoveryCruiseId ?? "",
		volume: m.volume?.toString() ?? "",
		weightInAir: m.weightInAir?.toString() ?? "",
		density: m.density?.toString() ?? "",
		dives: m.dives?.toString() ?? "",
		distanceKm: m.distanceKm?.toString() ?? "",
		iridiumMinutes: m.iridiumMinutes?.toString() ?? "",
	};
}

function toNumberOrNull(raw: string): number | null {
	if (raw.trim() === "") return null;
	const n = Number(raw);
	return Number.isNaN(n) ? null : n;
}

// Same modal for both creating a mission and editing an existing one --
// "edit" just skips the autopopulate box (there's no "previous mission"
// concept when you're already editing a specific one), seeds every
// field from the mission being edited instead of a blank form, and
// PATCHes instead of POSTs. In edit mode the dialog's open/close is
// externally controlled (mission/onClose) since the trigger is a
// per-row icon in MissionsTable, not a button this component owns.
export default function MissionFormDialog({
	mode,
	mission,
	onClose,
	missions,
	gliders,
	missionStatuses,
	projects,
	sites,
	contacts,
	institutes,
	cruises,
}: {
	mode: "create" | "edit";
	mission?: Mission | null;
	onClose?: () => void;
	missions: Mission[];
	gliders: Glider[];
	missionStatuses: LookupOption[];
	projects: LookupOption[];
	sites: LookupOption[];
	contacts: LookupOption[];
	institutes: LookupOption[];
	cruises: Cruise[];
}) {
	const router = useRouter();
	const [internalOpen, setInternalOpen] = useState(false);
	const open = mode === "create" ? internalOpen : mission != null;

	const [form, setForm] = useState<FormState>(emptyForm);
	const [autopopulateId, setAutopopulateId] = useState<number | "">("");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [banner, setBanner] = useState<{
		severity: "success" | "error";
		message: string;
	} | null>(null);

	const scheduledStatusId = useMemo(
		() =>
			missionStatuses.find((s) => s.name.toLowerCase() === "scheduled")?.id ??
			"",
		[missionStatuses],
	);

	function resetAll() {
		setForm({ ...emptyForm(), statusId: scheduledStatusId });
		setAutopopulateId("");
		setError(null);
	}

	function handleOpen() {
		resetAll();
		setInternalOpen(true);
	}

	function closeDialog() {
		if (mode === "create") setInternalOpen(false);
		else onClose?.();
	}

	// Re-seeds the form whenever a (different) mission is opened for
	// editing -- mission?.id going from unset to set covers both "start
	// editing" and "close then edit the same row again" (the parent nulls
	// mission on close, so id genuinely changes each time).
	// biome-ignore lint/correctness/useExhaustiveDependencies: mission object identity deliberately excluded -- keying on mission?.id avoids re-seeding on every parent render
	useEffect(() => {
		if (mode !== "edit" || !mission) return;
		setForm(formFromMission(mission));
		setAutopopulateId("");
		setError(null);
	}, [mode, mission?.id]);

	function handleGliderChange(id: number) {
		setForm((s) => ({ ...s, gliderAssetId: id }));
	}

	function handleAutopopulate(missionId: number) {
		const source = missions.find((m) => m.id === missionId);
		if (!source) return;
		setAutopopulateId(missionId);
		setForm((s) => ({
			...s,
			gliderAssetId: source.gliderAssetId ?? "",
			statusId: scheduledStatusId,
			projectId: source.projectId ?? "",
			siteId: source.siteId ?? "",
			principalInvestigatorId: source.principalInvestigatorId ?? "",
			technicalLeadId: source.technicalLeadId ?? "",
			operatingAgencyId: source.operatingAgencyId ?? "",
			fundingAgencyId: source.fundingAgencyId ?? "",
			// Dates and mission number are deliberately not carried over --
			// this mission hasn't happened yet.
			launchDate: "",
			launchLatitude: source.launchLatitude?.toString() ?? "",
			launchLongitude: source.launchLongitude?.toString() ?? "",
			launchCruiseId: source.launchCruiseId ?? "",
			endDateScience: "",
			recoveryDate: "",
			recoveryLatitude: source.recoveryLatitude?.toString() ?? "",
			recoveryLongitude: source.recoveryLongitude?.toString() ?? "",
			recoveryCruiseId: source.recoveryCruiseId ?? "",
			volume: source.volume?.toString() ?? "",
			weightInAir: source.weightInAir?.toString() ?? "",
			density: source.density?.toString() ?? "",
			dives: source.dives?.toString() ?? "",
			distanceKm: source.distanceKm?.toString() ?? "",
			iridiumMinutes: source.iridiumMinutes?.toString() ?? "",
			// L1/L2 dataset pointers belong to the source mission's data --
			// nothing to carry over to a mission that hasn't happened yet.
		}));
	}

	const statusName =
		missionStatuses.find((s) => s.id === form.statusId)?.name.toLowerCase() ??
		"";
	const isWorkshop = statusName === "workshop";
	const isScheduled = statusName === "scheduled";

	const gliderName = useMemo(
		() => gliders.find((g) => g.id === form.gliderAssetId)?.name ?? null,
		[gliders, form.gliderAssetId],
	);
	const projectName = useMemo(
		() => projects.find((p) => p.id === form.projectId)?.name ?? null,
		[projects, form.projectId],
	);
	const siteName = useMemo(
		() => sites.find((s) => s.id === form.siteId)?.name ?? null,
		[sites, form.siteId],
	);
	const missionNamePreview = previewMissionName(
		gliderName,
		projectName,
		siteName,
		form.launchDate || null,
	);

	function dismissBanner() {
		setBanner(null);
		router.refresh();
	}

	async function handleSave() {
		setError(null);
		// What a mission must have depends on its status: a workshop is just
		// a glider being prepared; scheduled adds a project and site; anything
		// further along (active, recovered, ...) also needs a launch date.
		const missionNumber = form.missionNumber.trim()
			? Number(form.missionNumber)
			: null;
		if (missionNumber !== null && Number.isNaN(missionNumber)) {
			setError("Mission number must be a number.");
			return;
		}
		if (!form.statusId) {
			setError("Status is required.");
			return;
		}
		if (!form.gliderAssetId) {
			setError("Glider is required.");
			return;
		}
		if (!isWorkshop && (!form.projectId || !form.siteId)) {
			setError("Project and site are required.");
			return;
		}
		if (!isWorkshop && !isScheduled && !form.launchDate) {
			setError("Launch date is required.");
			return;
		}

		setSaving(true);
		try {
			const payload = {
				missionNumber,
				gliderAssetId: form.gliderAssetId as number,
				statusId: form.statusId as number,
				projectId: form.projectId || null,
				siteId: form.siteId || null,
				launchDate: form.launchDate || null,
				principalInvestigatorId: form.principalInvestigatorId || null,
				technicalLeadId: form.technicalLeadId || null,
				operatingAgencyId: form.operatingAgencyId || null,
				fundingAgencyId: form.fundingAgencyId || null,
				launchLatitude: toNumberOrNull(form.launchLatitude),
				launchLongitude: toNumberOrNull(form.launchLongitude),
				launchCruiseId: form.launchCruiseId || null,
				endDateScience: form.endDateScience || null,
				recoveryDate: form.recoveryDate || null,
				recoveryLatitude: toNumberOrNull(form.recoveryLatitude),
				recoveryLongitude: toNumberOrNull(form.recoveryLongitude),
				recoveryCruiseId: form.recoveryCruiseId || null,
				volume: toNumberOrNull(form.volume),
				weightInAir: toNumberOrNull(form.weightInAir),
				density: toNumberOrNull(form.density),
				dives: toNumberOrNull(form.dives),
				distanceKm: toNumberOrNull(form.distanceKm),
				iridiumMinutes: toNumberOrNull(form.iridiumMinutes),
			};
			const result =
				mode === "edit" && mission
					? await updateMission(mission.id, payload)
					: await createMission(payload);
			closeDialog();
			setBanner({
				severity: "success",
				message:
					mode === "edit"
						? `Mission ${result.missionNumber != null ? `#${result.missionNumber}` : result.missionName} successfully updated!`
						: `Mission ${result.missionNumber != null ? `#${result.missionNumber}` : result.missionName} successfully created!`,
			});
		} catch (err) {
			setBanner({
				severity: "error",
				message:
					err instanceof Error
						? err.message
						: `Failed to ${mode === "edit" ? "update" : "create"} mission.`,
			});
		} finally {
			setSaving(false);
		}
	}

	const dialogTitle =
		mode === "edit" && mission
			? `Edit mission — ${mission.stdMissionName ?? mission.missionName ?? ""} (#${mission.missionNumber})`
			: "Add new mission";

	return (
		<>
			{mode === "create" && (
				<Button
					variant="contained"
					startIcon={<AddCircleOutlineIcon />}
					onClick={handleOpen}
				>
					Add new mission
				</Button>
			)}

			<Dialog open={open} onClose={closeDialog} maxWidth="md" fullWidth>
				<DialogTitle>{dialogTitle}</DialogTitle>
				<DialogContent
					dividers
					sx={{ display: "flex", flexDirection: "column", gap: 3 }}
				>
					{mode === "create" && (
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 1.5,
								bgcolor: "primary.50",
								border: "1px solid",
								borderColor: "primary.main",
								borderRadius: 1,
								p: 1.5,
							}}
						>
							<Typography
								variant="caption"
								sx={{ fontWeight: 700, whiteSpace: "nowrap" }}
							>
								Autopopulate from previous mission
							</Typography>
							<TextField
								select
								size="small"
								fullWidth
								value={autopopulateId}
								onChange={(e) => handleAutopopulate(Number(e.target.value))}
								SelectProps={{ displayEmpty: true }}
							>
								<MenuItem value="">— choose any past mission —</MenuItem>
								{missions.map((m) => (
									<MenuItem key={m.id} value={m.id}>
										{m.stdMissionName ?? m.missionName} (#{m.missionNumber})
									</MenuItem>
								))}
							</TextField>
						</Box>
					)}

					<Section label="Identity">
						<Grid>
							<Field label="Mission number">
								<TextField
									size="small"
									fullWidth
									value={form.missionNumber}
									onChange={(e) =>
										setForm((s) => ({ ...s, missionNumber: e.target.value }))
									}
									helperText={
										form.missionNumber
											? "Permanent identifier — can't be changed once set"
											: "Assigned automatically when the mission becomes active"
									}
									disabled={mode === "edit" && !!mission?.missionNumber}
								/>
							</Field>
							<Field label="Mission name" required span={2}>
								<TextField
									size="small"
									fullWidth
									disabled
									value={
										mode === "edit"
											? (mission?.missionName ?? "")
											: (missionNamePreview ?? "")
									}
									placeholder="Fills in once Glider, Project, Site and Launch date are set"
									helperText={
										mode === "edit"
											? "Kept as originally entered — the standard name updates automatically"
											: undefined
									}
								/>
							</Field>
							<Field label="Glider" required>
								<TextField
									select
									size="small"
									fullWidth
									value={form.gliderAssetId}
									onChange={(e) => handleGliderChange(Number(e.target.value))}
								>
									{gliders.map((g) => (
										<MenuItem key={g.id} value={g.id}>
											{g.name}
										</MenuItem>
									))}
								</TextField>
							</Field>
							<Field label="Status">
								<TextField
									select
									size="small"
									fullWidth
									value={form.statusId}
									onChange={(e) =>
										setForm((s) => ({ ...s, statusId: Number(e.target.value) }))
									}
								>
									{missionStatuses.map((s) => (
										<MenuItem key={s.id} value={s.id}>
											{s.name}
										</MenuItem>
									))}
								</TextField>
							</Field>
						</Grid>
					</Section>

					<Section label="Project & people">
						<Grid>
							<Field label="Project" required={!isWorkshop}>
								<LookupSelect
									value={form.projectId}
									options={projects}
									onChange={(v) => setForm((s) => ({ ...s, projectId: v }))}
								/>
							</Field>
							<Field label="Site" required={!isWorkshop}>
								<LookupSelect
									value={form.siteId}
									options={sites}
									onChange={(v) => setForm((s) => ({ ...s, siteId: v }))}
								/>
							</Field>
							<Field label="Principal investigator">
								<LookupSelect
									value={form.principalInvestigatorId}
									options={contacts}
									onChange={(v) =>
										setForm((s) => ({ ...s, principalInvestigatorId: v }))
									}
								/>
							</Field>
							<Field label="Technical lead">
								<LookupSelect
									value={form.technicalLeadId}
									options={contacts}
									onChange={(v) =>
										setForm((s) => ({ ...s, technicalLeadId: v }))
									}
								/>
							</Field>
							<Field label="Operating agency">
								<LookupSelect
									value={form.operatingAgencyId}
									options={institutes}
									onChange={(v) =>
										setForm((s) => ({ ...s, operatingAgencyId: v }))
									}
								/>
							</Field>
							<Field label="Funding agency">
								<LookupSelect
									value={form.fundingAgencyId}
									options={institutes}
									onChange={(v) =>
										setForm((s) => ({ ...s, fundingAgencyId: v }))
									}
								/>
							</Field>
						</Grid>
					</Section>

					<Section label="Launch">
						<Grid>
							<Field label="Launch date" required={!isWorkshop && !isScheduled}>
								<TextField
									size="small"
									fullWidth
									type="date"
									InputLabelProps={{ shrink: true }}
									value={form.launchDate}
									onChange={(e) =>
										setForm((s) => ({ ...s, launchDate: e.target.value }))
									}
								/>
							</Field>
							<Field label="Launch latitude">
								<TextField
									size="small"
									fullWidth
									value={form.launchLatitude}
									onChange={(e) =>
										setForm((s) => ({ ...s, launchLatitude: e.target.value }))
									}
								/>
							</Field>
							<Field label="Launch longitude">
								<TextField
									size="small"
									fullWidth
									value={form.launchLongitude}
									onChange={(e) =>
										setForm((s) => ({ ...s, launchLongitude: e.target.value }))
									}
								/>
							</Field>
							<Field label="Launch cruise" span={3}>
								<TextField
									select
									size="small"
									fullWidth
									value={form.launchCruiseId}
									onChange={(e) =>
										setForm((s) => ({
											...s,
											launchCruiseId: e.target.value
												? Number(e.target.value)
												: "",
										}))
									}
								>
									<MenuItem value="">—</MenuItem>
									{cruises.map((c) => (
										<MenuItem key={c.id} value={c.id}>
											{c.cruiseName}
										</MenuItem>
									))}
								</TextField>
							</Field>
						</Grid>
					</Section>

					<Section label="Recovery">
						<Grid>
							<Field label="End date (science)">
								<TextField
									size="small"
									fullWidth
									type="date"
									InputLabelProps={{ shrink: true }}
									value={form.endDateScience}
									onChange={(e) =>
										setForm((s) => ({ ...s, endDateScience: e.target.value }))
									}
								/>
							</Field>
							<Field label="Recovery date">
								<TextField
									size="small"
									fullWidth
									type="date"
									InputLabelProps={{ shrink: true }}
									value={form.recoveryDate}
									onChange={(e) =>
										setForm((s) => ({ ...s, recoveryDate: e.target.value }))
									}
								/>
							</Field>
							<Field label="Recovery latitude">
								<TextField
									size="small"
									fullWidth
									value={form.recoveryLatitude}
									onChange={(e) =>
										setForm((s) => ({ ...s, recoveryLatitude: e.target.value }))
									}
								/>
							</Field>
							<Field label="Recovery longitude">
								<TextField
									size="small"
									fullWidth
									value={form.recoveryLongitude}
									onChange={(e) =>
										setForm((s) => ({
											...s,
											recoveryLongitude: e.target.value,
										}))
									}
								/>
							</Field>
							<Field label="Recovery cruise" span={2}>
								<TextField
									select
									size="small"
									fullWidth
									value={form.recoveryCruiseId}
									onChange={(e) =>
										setForm((s) => ({
											...s,
											recoveryCruiseId: e.target.value
												? Number(e.target.value)
												: "",
										}))
									}
								>
									<MenuItem value="">—</MenuItem>
									{cruises.map((c) => (
										<MenuItem key={c.id} value={c.id}>
											{c.cruiseName}
										</MenuItem>
									))}
								</TextField>
							</Field>
						</Grid>
					</Section>

					<Section label="Physical & telemetry">
						<Grid>
							<Field label="Volume">
								<TextField
									size="small"
									fullWidth
									value={form.volume}
									onChange={(e) =>
										setForm((s) => ({ ...s, volume: e.target.value }))
									}
								/>
							</Field>
							<Field label="Weight in air">
								<TextField
									size="small"
									fullWidth
									value={form.weightInAir}
									onChange={(e) =>
										setForm((s) => ({ ...s, weightInAir: e.target.value }))
									}
								/>
							</Field>
							<Field label="Density">
								<TextField
									size="small"
									fullWidth
									value={form.density}
									onChange={(e) =>
										setForm((s) => ({ ...s, density: e.target.value }))
									}
								/>
							</Field>
							<Field label="Dives">
								<TextField
									size="small"
									fullWidth
									value={form.dives}
									onChange={(e) =>
										setForm((s) => ({ ...s, dives: e.target.value }))
									}
								/>
							</Field>
							<Field label="Distance (km)">
								<TextField
									size="small"
									fullWidth
									value={form.distanceKm}
									onChange={(e) =>
										setForm((s) => ({ ...s, distanceKm: e.target.value }))
									}
								/>
							</Field>
							<Field label="Iridium minutes">
								<TextField
									size="small"
									fullWidth
									value={form.iridiumMinutes}
									onChange={(e) =>
										setForm((s) => ({ ...s, iridiumMinutes: e.target.value }))
									}
								/>
							</Field>
						</Grid>
					</Section>

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
							: mode === "edit"
								? "Save changes"
								: "Save mission"}
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

function Section({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<Box>
			<Typography
				variant="overline"
				color="text.secondary"
				sx={{ display: "block", mb: 1, letterSpacing: 1 }}
			>
				{label}
			</Typography>
			{children}
		</Box>
	);
}

function Grid({ children }: { children: React.ReactNode }) {
	return (
		<Box
			sx={{
				display: "grid",
				gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
				gap: 2,
			}}
		>
			{children}
		</Box>
	);
}

function Field({
	label,
	required,
	span,
	children,
}: {
	label: string;
	required?: boolean;
	span?: number;
	children: React.ReactNode;
}) {
	return (
		<Box sx={{ gridColumn: span ? `span ${span}` : undefined }}>
			<Typography
				variant="caption"
				sx={{ display: "block", mb: 0.5, fontWeight: 600 }}
			>
				{label}
				{required && (
					<Box component="span" sx={{ color: "error.main", ml: 0.3 }}>
						*
					</Box>
				)}
			</Typography>
			{children}
		</Box>
	);
}

function LookupSelect({
	value,
	options,
	onChange,
}: {
	value: number | "";
	options: LookupOption[];
	onChange: (value: number | "") => void;
}) {
	return (
		<TextField
			select
			size="small"
			fullWidth
			value={value}
			onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
		>
			<MenuItem value="">—</MenuItem>
			{options.map((o) => (
				<MenuItem key={o.id} value={o.id}>
					{o.name}
				</MenuItem>
			))}
		</TextField>
	);
}
