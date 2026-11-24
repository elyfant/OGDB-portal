import type { RefurbBatteryCandidate } from "@ogdb/types";

// 3 % of capacity lost per year of age, the figure the paper logsheet used.
// Keep in step with DERATING_PER_YEAR in the gateway's batteries.service.ts,
// which is what is actually stored; this only previews it before saving.
const DERATING_PER_YEAR = 0.03;
const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

export interface BatteryPreview {
	derating: number | null;
	remaining: number | null;
	fuelGaugeAh: number | null;
}

// Derating is calculated at the INSTALL date, not today: the paper sheet used
// TODAY(), so the figure drifted every time the file was opened.
export function previewBattery(
	asset: RefurbBatteryCandidate | undefined,
	installedOn: string,
): BatteryPreview {
	if (!asset?.dateOfManufacture || !installedOn) {
		return { derating: null, remaining: null, fuelGaugeAh: null };
	}
	const years =
		(Date.parse(installedOn) - Date.parse(asset.dateOfManufacture)) /
		MS_PER_YEAR;
	if (!Number.isFinite(years)) {
		return { derating: null, remaining: null, fuelGaugeAh: null };
	}
	const derating =
		Math.round(Math.min(1, Math.max(0, years * DERATING_PER_YEAR)) * 10000) /
		10000;
	const remaining = Math.round((1 - derating) * 10000) / 10000;
	const fuelGaugeAh =
		asset.capacityAh === null
			? null
			: Math.round(asset.capacityAh * remaining * 10) / 10;
	return { derating, remaining, fuelGaugeAh };
}

// The pdos variable a pack's fuel gauge goes into, e.g. $AH0_24V.
export function ah0Name(asset: RefurbBatteryCandidate | undefined): string {
	return asset?.nominalVoltage ? `$AH0_${asset.nominalVoltage}V` : "$AH0";
}

export const percent = (fraction: number | null, digits = 1) =>
	fraction === null ? "—" : `${(fraction * 100).toFixed(digits)} %`;

export const batteryLabel = (a: RefurbBatteryCandidate | undefined) =>
	a ? `${a.serialNumber ?? `#${a.id}`} · ${a.model ?? "unknown model"}` : "—";
