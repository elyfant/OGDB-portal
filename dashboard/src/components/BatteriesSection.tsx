"use client";

import { saveBatteryChecks, saveBatteryPack } from "@/lib/api-client";
import { positionOptionLabel } from "@/lib/asset-positions";
import { formatDate } from "@/lib/format";
import {
	ah0Name,
	batteryLabel,
	percent,
	previewBattery,
} from "@/lib/refurb-batteries";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type {
	RefurbBatteries,
	RefurbBatteryCandidate,
	RefurbBatteryPack,
} from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

const GRID = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
	gap: 2,
} as const;

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const numOrNull = (s: string) =>
	s.trim() === "" ? null : Number(s.replace(",", "."));

// Section 5 of the refurbishment logsheet. One card per battery slot: what
// was taken out, what went in, weights and voltages, and the derating and
// fuel-gauge value worked out from the INSTALL date. Choosing a different
// battery also changes this mission's build, so the two cannot disagree.
export default function BatteriesSection({
	missionId,
	data,
	canEdit,
	platform,
	platformModel,
}: {
	missionId: number;
	data: RefurbBatteries;
	canEdit: boolean;
	platform: string | null;
	platformModel: string | null;
}) {
	const assetById = new Map(
		[...data.assets, ...data.candidates].map((a) => [a.id, a]),
	);
	return (
		<Box>
			<Stack spacing={1.5}>
				{data.packs.map((pack) => (
					<PackCard
						key={`${pack.position}-${pack.updatedAt}`}
						missionId={missionId}
						pack={pack}
						label={positionOptionLabel(
							"battery",
							pack.position,
							platform,
							platformModel,
						)}
						candidates={data.candidates}
						assetById={assetById}
						canEdit={canEdit}
					/>
				))}
				<ChecksCard
					key={`checks-${data.checks.updatedAt}`}
					missionId={missionId}
					data={data}
					canEdit={canEdit}
				/>
			</Stack>
		</Box>
	);
}

function PackCard({
	missionId,
	pack,
	label,
	candidates,
	assetById,
	canEdit,
}: {
	missionId: number;
	pack: RefurbBatteryPack;
	label: string;
	candidates: RefurbBatteryCandidate[];
	assetById: Map<number, RefurbBatteryCandidate>;
	canEdit: boolean;
}) {
	const router = useRouter();
	const initial = {
		installedAssetId: pack.installedAssetId,
		installedOn: str(pack.installedOn),
		installedWeightG: str(pack.installedWeightG),
		installedVoltageV: str(pack.installedVoltageV),
		removedWeightG: str(pack.removedWeightG),
		removedVoltageV: str(pack.removedVoltageV),
		notes: str(pack.notes),
	};
	const [form, setForm] = useState(initial);
	const [showAll, setShowAll] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const dirty = JSON.stringify(form) !== JSON.stringify(initial);
	const removed = pack.removedAssetId
		? assetById.get(pack.removedAssetId)
		: undefined;
	const installed = form.installedAssetId
		? assetById.get(form.installedAssetId)
		: undefined;
	const kept =
		pack.removedAssetId !== null &&
		pack.removedAssetId === form.installedAssetId;
	const disabled = !canEdit || busy;

	// Replacement options: the same kind of pack as the one removed (same
	// nominal voltage), unless the tech asks for every model.
	const options =
		showAll || !removed?.nominalVoltage
			? candidates
			: candidates.filter((c) => c.nominalVoltage === removed.nominalVoltage);

	// Before saving, preview the figures; after saving, show what was stored.
	const live = previewBattery(installed, form.installedOn);
	const shown =
		dirty || !pack.saved
			? live
			: {
					derating: pack.derating,
					remaining: pack.remaining,
					fuelGaugeAh: pack.fuelGaugeAh,
				};

	const set = (patch: Partial<typeof form>) =>
		setForm((f) => ({ ...f, ...patch }));

	async function save() {
		setBusy(true);
		setError(null);
		try {
			await saveBatteryPack(missionId, pack.position, {
				installedAssetId: form.installedAssetId,
				installedOn: form.installedOn || null,
				installedWeightG: numOrNull(form.installedWeightG),
				installedVoltageV: numOrNull(form.installedVoltageV),
				removedWeightG: numOrNull(form.removedWeightG),
				removedVoltageV: numOrNull(form.removedVoltageV),
				notes: form.notes || null,
			});
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save.");
		} finally {
			setBusy(false);
		}
	}

	const num = (key: keyof typeof form, text: string, unit: string) => (
		<TextField
			size="small"
			label={`${text} (${unit})`}
			value={form[key] as string}
			onChange={(e) => set({ [key]: e.target.value })}
			disabled={disabled}
			slotProps={{ htmlInput: { inputMode: "decimal" } }}
		/>
	);

	return (
		<Paper variant="outlined" sx={{ p: 2 }}>
			<Stack
				direction="row"
				spacing={1.5}
				sx={{ alignItems: "center", flexWrap: "wrap", mb: 1.5 }}
			>
				<Typography sx={{ fontWeight: 600 }}>{label} battery</Typography>
				<Typography variant="caption" color="text.secondary">
					slot: {pack.position}
				</Typography>
				{pack.saved && !dirty && (
					<Chip size="small" color="success" label="Saved" />
				)}
				{dirty && <Chip size="small" color="warning" label="Unsaved" />}
				{kept && <Chip size="small" label="Kept (checked, not replaced)" />}
			</Stack>

			<Typography variant="body2" sx={{ mb: 1 }}>
				<strong>Removed:</strong>{" "}
				{removed
					? `${batteryLabel(removed)}${removed.dateOfManufacture ? ` · made ${formatDate(removed.dateOfManufacture)}` : ""}`
					: "nothing recorded in this slot"}
			</Typography>
			{removed && !kept && (
				<Box sx={{ ...GRID, mb: 2 }}>
					{num("removedWeightG", "Removed weight", "g")}
					{num("removedVoltageV", "Removed voltage", "V")}
				</Box>
			)}

			<Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
				Installed
			</Typography>
			<Autocomplete
				size="small"
				options={options}
				value={installed ?? null}
				onChange={(_, c) =>
					set({
						installedAssetId: c?.id ?? null,
						// Default the install date to today once a battery is chosen.
						installedOn:
							c && !form.installedOn
								? new Date().toISOString().slice(0, 10)
								: form.installedOn,
					})
				}
				getOptionLabel={(c) => batteryLabel(c)}
				groupBy={(c) => c.model ?? "Unknown model"}
				isOptionEqualToValue={(a, b) => a.id === b.id}
				disabled={disabled}
				renderInput={(params) => (
					<TextField {...params} label="Battery (serial · model)" />
				)}
				sx={{ mb: 1 }}
			/>
			{!showAll && removed?.nominalVoltage && (
				<Button size="small" onClick={() => setShowAll(true)} sx={{ mb: 1 }}>
					Show all models
				</Button>
			)}
			<Box sx={{ ...GRID, mb: 2 }}>
				<TextField
					size="small"
					type="date"
					label="Installed on"
					value={form.installedOn}
					onChange={(e) => set({ installedOn: e.target.value })}
					disabled={disabled}
					slotProps={{ inputLabel: { shrink: true } }}
				/>
				{num("installedWeightG", "Weight", "g")}
				{num("installedVoltageV", "Voltage", "V")}
			</Box>

			{installed && (
				<Box sx={{ mb: 2 }}>
					<Typography variant="body2" color="text.secondary">
						Made{" "}
						{installed.dateOfManufacture
							? formatDate(installed.dateOfManufacture)
							: "— (date of manufacture not recorded)"}
						{installed.capacityAh !== null &&
							` · ${installed.capacityAh} Ah nominal`}
					</Typography>
					<Typography variant="body2">
						Derating {percent(shown.derating)} at install · remaining{" "}
						{percent(shown.remaining)}
					</Typography>
					<Typography variant="body2" sx={{ fontWeight: 600 }}>
						{ah0Name(installed)} ={" "}
						{shown.fuelGaugeAh === null ? "—" : `${shown.fuelGaugeAh} Ah`}
					</Typography>
					<Typography variant="caption" color="text.secondary">
						Calculated from the install date, so it does not change later.
					</Typography>
				</Box>
			)}

			<TextField
				size="small"
				fullWidth
				multiline
				minRows={2}
				label="Notes"
				value={form.notes}
				onChange={(e) => set({ notes: e.target.value })}
				disabled={disabled}
			/>

			{error && (
				<Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			)}
			{pack.updatedAt && (
				<Typography
					variant="caption"
					color="text.secondary"
					display="block"
					sx={{ mt: 1 }}
				>
					Last saved {formatDate(pack.updatedAt)}
					{pack.updatedByName ? ` by ${pack.updatedByName}` : ""}
				</Typography>
			)}
			{canEdit && (
				<Box sx={{ mt: 1.5 }}>
					<Button
						variant="contained"
						size="small"
						onClick={save}
						disabled={!dirty || busy}
					>
						{busy ? "Saving…" : `Save ${label.toLowerCase()} battery`}
					</Button>
					{dirty && installed && installed.id !== pack.buildAssetId && (
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{ ml: 1.5 }}
						>
							Saving also changes this mission's build.
						</Typography>
					)}
				</Box>
			)}
		</Paper>
	);
}

function ChecksCard({
	missionId,
	data,
	canEdit,
}: {
	missionId: number;
	data: RefurbBatteries;
	canEdit: boolean;
}) {
	const router = useRouter();
	const c = data.checks;
	const initial = {
		fuelGaugesReset: c.fuelGaugesReset,
		ah0Updated: c.ah0Updated,
		gpsCellReplaced:
			c.gpsCellReplaced === null ? "" : String(c.gpsCellReplaced),
		gpsCellManufactured: str(c.gpsCellManufactured),
	};
	const [form, setForm] = useState(initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const dirty = JSON.stringify(form) !== JSON.stringify(initial);
	const disabled = !canEdit || busy;

	// Which pdos variables the tech has to enter, from the installed packs.
	const ah0 = data.packs
		.map((p) => {
			const a = p.installedAssetId
				? data.assets.find((x) => x.id === p.installedAssetId)
				: undefined;
			return a && p.fuelGaugeAh !== null
				? `${ah0Name(a)} = ${p.fuelGaugeAh}`
				: null;
		})
		.filter((x): x is string => x !== null);

	async function save() {
		setBusy(true);
		setError(null);
		try {
			await saveBatteryChecks(missionId, {
				fuelGaugesReset: form.fuelGaugesReset,
				ah0Updated: form.ah0Updated,
				gpsCellReplaced:
					form.gpsCellReplaced === "" ? null : form.gpsCellReplaced === "true",
				gpsCellManufactured: form.gpsCellManufactured || null,
			});
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Paper variant="outlined" sx={{ p: 2 }}>
			<Typography sx={{ fontWeight: 600, mb: 1 }}>
				Fuel gauges and GPS cell
			</Typography>
			<Stack>
				<FormControlLabel
					control={
						<Checkbox
							checked={form.fuelGaugesReset}
							disabled={disabled}
							onChange={(e) =>
								setForm((f) => ({ ...f, fuelGaugesReset: e.target.checked }))
							}
						/>
					}
					label="Fuel gauges viewed and reset"
				/>
				<FormControlLabel
					control={
						<Checkbox
							checked={form.ah0Updated}
							disabled={disabled}
							onChange={(e) =>
								setForm((f) => ({ ...f, ah0Updated: e.target.checked }))
							}
						/>
					}
					label={`Fuel-gauge values entered in pdos${ah0.length ? ` (${ah0.join(", ")})` : ""}`}
				/>
			</Stack>
			<Box sx={{ ...GRID, mt: 1 }}>
				<TextField
					select
					size="small"
					label="GPS board coin cell (CR2450) replaced?"
					value={form.gpsCellReplaced}
					onChange={(e) =>
						setForm((f) => ({ ...f, gpsCellReplaced: e.target.value }))
					}
					disabled={disabled}
				>
					<MenuItem value="">—</MenuItem>
					<MenuItem value="true">Yes</MenuItem>
					<MenuItem value="false">No</MenuItem>
				</TextField>
				<TextField
					size="small"
					type="date"
					label="Coin cell date of manufacture"
					value={form.gpsCellManufactured}
					onChange={(e) =>
						setForm((f) => ({ ...f, gpsCellManufactured: e.target.value }))
					}
					disabled={disabled}
					slotProps={{ inputLabel: { shrink: true } }}
				/>
			</Box>
			{error && (
				<Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>
					{error}
				</Alert>
			)}
			{c.updatedAt && (
				<Typography
					variant="caption"
					color="text.secondary"
					display="block"
					sx={{ mt: 1 }}
				>
					Last saved {formatDate(c.updatedAt)}
					{c.updatedByName ? ` by ${c.updatedByName}` : ""}
				</Typography>
			)}
			{canEdit && (
				<Button
					variant="contained"
					size="small"
					sx={{ mt: 1.5 }}
					onClick={save}
					disabled={!dirty || busy}
				>
					{busy ? "Saving…" : "Save"}
				</Button>
			)}
		</Paper>
	);
}
