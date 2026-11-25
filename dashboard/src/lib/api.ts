import "server-only";
import type {
	ArgosTagDetail,
	Asset,
	AssetChange,
	AssetDetails,
	AssetRmaSummary,
	AssetStatusHistoryEntry,
	AssetStatusOption,
	AssetWear,
	Battery,
	BatteryDetail,
	CalibrationCatalogueRow,
	CalibrationCatalogueTypeGroup,
	Cruise,
	DatasetProcessingDetail,
	DatasetProcessingStatus,
	Glider,
	GliderBuild,
	GliderDeployment,
	IridiumGliderMonth,
	IridiumMissionCost,
	IridiumMissionDetail,
	IridiumMonthlyCost,
	IridiumSummary,
	LookupOption,
	Mission,
	MissionBuild,
	MissionFile,
	MissionMapEntry,
	MissionTrackPoint,
	MissionsLeaderboard,
	MissionsSummary,
	OgdbUser,
	ProcessingPackage,
	RefurbBatteries,
	RefurbDeviceTests,
	RefurbFinalPrep,
	RefurbInspection,
	RefurbIntake,
	RefurbSensors,
	RefurbSoftware,
	RefurbTestLinks,
	RefurbVacuum,
	Refurbishment,
	Rma,
	RmaAsset,
	RmaCatalogueRow,
	RmaEvent,
	ServicingEvent,
	ServicingEventTypeOption,
	TankRun,
} from "@ogdb/types";
import { redirect } from "next/navigation";
import { getSessionToken } from "./auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

async function apiFetch(path: string): Promise<Response> {
	const token = await getSessionToken();
	const res = await fetch(`${API_URL}${path}`, {
		cache: "no-store",
		headers: token ? { Authorization: `Bearer ${token}` } : undefined,
	});
	if (res.status === 401) {
		redirect("/login");
	}
	return res;
}

export async function getGliders(): Promise<Glider[]> {
	const res = await apiFetch("/gliders");
	if (!res.ok) {
		throw new Error(`Failed to fetch gliders: ${res.status}`);
	}
	return res.json();
}

export async function getGlider(id: number): Promise<Glider | null> {
	const res = await apiFetch(`/gliders/${id}`);
	if (res.status === 404) return null;
	if (!res.ok) {
		throw new Error(`Failed to fetch glider ${id}: ${res.status}`);
	}
	return res.json();
}

export async function getGliderBuild(id: number): Promise<GliderBuild> {
	const res = await apiFetch(`/gliders/${id}/build`);
	if (!res.ok) {
		throw new Error(`Failed to fetch glider ${id} build: ${res.status}`);
	}
	return res.json();
}

export async function getAssets(): Promise<Asset[]> {
	const res = await apiFetch("/assets");
	if (!res.ok) {
		throw new Error(`Failed to fetch assets: ${res.status}`);
	}
	return res.json();
}

export async function getAsset(id: number): Promise<Asset | null> {
	const res = await apiFetch(`/assets/${id}`);
	if (res.status === 404) return null;
	if (!res.ok) {
		throw new Error(`Failed to fetch asset ${id}: ${res.status}`);
	}
	return res.json();
}

export async function getBatteries(): Promise<Battery[]> {
	const res = await apiFetch("/assets/batteries");
	if (!res.ok) {
		throw new Error(`Failed to fetch batteries: ${res.status}`);
	}
	return res.json();
}

export async function getCruises(): Promise<Cruise[]> {
	const res = await apiFetch("/cruises");
	if (!res.ok) {
		throw new Error(`Failed to fetch cruises: ${res.status}`);
	}
	return res.json();
}

export async function getCruise(id: number): Promise<Cruise | null> {
	const res = await apiFetch(`/cruises/${id}`);
	if (res.status === 404) return null;
	if (!res.ok) {
		throw new Error(`Failed to fetch cruise ${id}: ${res.status}`);
	}
	return res.json();
}

export async function getStatusOptions(): Promise<AssetStatusOption[]> {
	const res = await apiFetch("/asset-status-options");
	if (!res.ok) {
		throw new Error(`Failed to fetch status options: ${res.status}`);
	}
	return res.json();
}

export async function getProjects(): Promise<LookupOption[]> {
	const res = await apiFetch("/lookups/projects");
	if (!res.ok) {
		throw new Error(`Failed to fetch projects: ${res.status}`);
	}
	return res.json();
}

export async function getObservatories(): Promise<LookupOption[]> {
	const res = await apiFetch("/lookups/observatories");
	if (!res.ok) {
		throw new Error(`Failed to fetch observatories: ${res.status}`);
	}
	return res.json();
}

export async function getAgencies(): Promise<LookupOption[]> {
	const res = await apiFetch("/lookups/agencies");
	if (!res.ok) {
		throw new Error(`Failed to fetch agencies: ${res.status}`);
	}
	return res.json();
}

export async function getVessels(): Promise<LookupOption[]> {
	const res = await apiFetch("/lookups/vessels");
	if (!res.ok) {
		throw new Error(`Failed to fetch vessels: ${res.status}`);
	}
	return res.json();
}

export async function getPlatforms(): Promise<LookupOption[]> {
	const res = await apiFetch("/lookups/platforms");
	if (!res.ok) {
		throw new Error(`Failed to fetch platforms: ${res.status}`);
	}
	return res.json();
}

export async function getSensorModels(): Promise<LookupOption[]> {
	const res = await apiFetch("/lookups/sensor-models");
	if (!res.ok) {
		throw new Error(`Failed to fetch sensor models: ${res.status}`);
	}
	return res.json();
}

export async function getBatteryModels(): Promise<LookupOption[]> {
	const res = await apiFetch("/lookups/battery-models");
	if (!res.ok) {
		throw new Error(`Failed to fetch battery models: ${res.status}`);
	}
	return res.json();
}

export async function getAssetTypes(): Promise<LookupOption[]> {
	const res = await apiFetch("/lookups/asset-types");
	if (!res.ok) {
		throw new Error(`Failed to fetch asset types: ${res.status}`);
	}
	return res.json();
}

export async function getContacts(): Promise<LookupOption[]> {
	const res = await apiFetch("/lookups/contacts");
	if (!res.ok) {
		throw new Error(`Failed to fetch contacts: ${res.status}`);
	}
	return res.json();
}

export async function getMissionStatuses(): Promise<LookupOption[]> {
	const res = await apiFetch("/lookups/mission-statuses");
	if (!res.ok) {
		throw new Error(`Failed to fetch mission statuses: ${res.status}`);
	}
	return res.json();
}

export async function getEndingCauses(): Promise<LookupOption[]> {
	const res = await apiFetch("/lookups/ending-causes");
	if (!res.ok) {
		throw new Error(`Failed to fetch ending causes: ${res.status}`);
	}
	return res.json();
}

export async function getMissions(): Promise<Mission[]> {
	const res = await apiFetch("/missions");
	if (!res.ok) {
		throw new Error(`Failed to fetch missions: ${res.status}`);
	}
	return res.json();
}

export async function getDatasetProcessingStatuses(): Promise<
	DatasetProcessingStatus[]
> {
	const res = await apiFetch("/datasets");
	if (!res.ok) {
		throw new Error(`Failed to fetch dataset processing status: ${res.status}`);
	}
	return res.json();
}

export async function getDatasetProcessingDetail(
	missionId: number,
): Promise<DatasetProcessingDetail | null> {
	const res = await apiFetch(`/datasets/${missionId}`);
	if (res.status === 404) return null;
	if (!res.ok) {
		throw new Error(
			`Failed to fetch dataset processing detail for mission ${missionId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getOgdbUsers(): Promise<OgdbUser[]> {
	const res = await apiFetch("/users");
	if (!res.ok) {
		throw new Error(`Failed to fetch users: ${res.status}`);
	}
	return res.json();
}

export async function getProcessingPackages(): Promise<ProcessingPackage[]> {
	const res = await apiFetch("/processing-packages");
	if (!res.ok) {
		throw new Error(`Failed to fetch processing packages: ${res.status}`);
	}
	return res.json();
}

export async function getMission(id: number): Promise<Mission | null> {
	const res = await apiFetch(`/missions/${id}`);
	if (res.status === 404) return null;
	if (!res.ok) {
		throw new Error(`Failed to fetch mission ${id}: ${res.status}`);
	}
	return res.json();
}

export async function getMissionMapEntries(): Promise<MissionMapEntry[]> {
	const res = await apiFetch("/missions/map");
	if (!res.ok) {
		throw new Error(`Failed to fetch mission map entries: ${res.status}`);
	}
	return res.json();
}

export async function getMissionTracks(
	id: number,
): Promise<MissionTrackPoint[]> {
	const res = await apiFetch(`/missions/${id}/tracks`);
	if (!res.ok) {
		throw new Error(`Failed to fetch tracks for mission ${id}: ${res.status}`);
	}
	return res.json();
}

export async function getMissionBuild(id: number): Promise<MissionBuild> {
	const res = await apiFetch(`/missions/${id}/build`);
	if (!res.ok) {
		throw new Error(`Failed to fetch build for mission ${id}: ${res.status}`);
	}
	return res.json();
}

export async function getMissionFiles(id: number): Promise<MissionFile[]> {
	const res = await apiFetch(`/missions/${id}/files`);
	if (!res.ok) {
		throw new Error(`Failed to fetch files for mission ${id}: ${res.status}`);
	}
	return res.json();
}

// The mission's refurbishment logsheet header, or null if none has been
// started. The gateway answers an empty 200 body for "none".
export async function getRefurbishment(
	missionId: number,
): Promise<Refurbishment | null> {
	const res = await apiFetch(`/missions/${missionId}/refurbishment`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch refurbishment for mission ${missionId}: ${res.status}`,
		);
	}
	const text = await res.text();
	return text ? (JSON.parse(text) as Refurbishment) : null;
}

export async function getRefurbBatteries(
	missionId: number,
): Promise<RefurbBatteries> {
	const res = await apiFetch(`/missions/${missionId}/refurbishment/batteries`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch batteries for mission ${missionId}: ${res.status}`,
		);
	}
	return res.json();
}

// An Argos tag's configuration and test history (asset page).
export async function getArgosTag(assetId: number): Promise<ArgosTagDetail> {
	const res = await apiFetch(`/assets/${assetId}/argos`);
	if (!res.ok) {
		throw new Error(`Failed to fetch Argos tag ${assetId}: ${res.status}`);
	}
	return res.json();
}

export async function getRefurbSensors(
	missionId: number,
): Promise<RefurbSensors> {
	const res = await apiFetch(`/missions/${missionId}/refurbishment/sensors`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch sensors for mission ${missionId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getRefurbTestLinks(
	missionId: number,
): Promise<RefurbTestLinks> {
	const res = await apiFetch(`/missions/${missionId}/refurbishment/test-links`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch test links for mission ${missionId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getRefurbIntake(
	missionId: number,
): Promise<RefurbIntake> {
	const res = await apiFetch(`/missions/${missionId}/refurbishment/intake`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch intake for mission ${missionId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getRefurbSoftware(
	missionId: number,
): Promise<RefurbSoftware> {
	const res = await apiFetch(`/missions/${missionId}/refurbishment/software`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch software track for mission ${missionId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getRefurbFinalPrep(
	missionId: number,
): Promise<RefurbFinalPrep> {
	const res = await apiFetch(`/missions/${missionId}/refurbishment/final-prep`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch final prep for mission ${missionId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getRefurbInspection(
	missionId: number,
): Promise<RefurbInspection> {
	const res = await apiFetch(`/missions/${missionId}/refurbishment/inspection`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch inspections for mission ${missionId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getRefurbVacuum(
	missionId: number,
): Promise<RefurbVacuum> {
	const res = await apiFetch(`/missions/${missionId}/refurbishment/vacuum`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch close and vacuum for mission ${missionId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getRefurbDeviceTests(
	missionId: number,
): Promise<RefurbDeviceTests> {
	const res = await apiFetch(
		`/missions/${missionId}/refurbishment/device-tests`,
	);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch device tests for mission ${missionId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getTankRuns(missionId: number): Promise<TankRun[]> {
	const res = await apiFetch(`/missions/${missionId}/refurbishment/tank-runs`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch tank runs for mission ${missionId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getCalibrationCatalogue(): Promise<
	CalibrationCatalogueTypeGroup[]
> {
	const res = await apiFetch("/calibrations");
	if (!res.ok) {
		throw new Error(`Failed to fetch calibration catalogue: ${res.status}`);
	}
	return res.json();
}

export async function getMissionsSummary(): Promise<MissionsSummary> {
	const res = await apiFetch("/missions/summary");
	if (!res.ok) {
		throw new Error(`Failed to fetch missions summary: ${res.status}`);
	}
	return res.json();
}

export async function getMissionsLeaderboard(): Promise<MissionsLeaderboard> {
	const res = await apiFetch("/missions/leaderboard");
	if (!res.ok) {
		throw new Error(`Failed to fetch missions leaderboard: ${res.status}`);
	}
	return res.json();
}

export async function getAssetCalibrations(
	assetId: number,
): Promise<CalibrationCatalogueRow[]> {
	const res = await apiFetch(`/assets/${assetId}/calibrations`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch calibrations for asset ${assetId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getAssetDetails(assetId: number): Promise<AssetDetails> {
	const res = await apiFetch(`/assets/${assetId}/details`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch details for asset ${assetId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getAssetStatusHistory(
	assetId: number,
): Promise<AssetStatusHistoryEntry[]> {
	const res = await apiFetch(`/assets/${assetId}/status-history`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch status history for asset ${assetId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getAssetChanges(assetId: number): Promise<AssetChange[]> {
	const res = await apiFetch(`/assets/${assetId}/changes`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch change log for asset ${assetId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getAssetBattery(assetId: number): Promise<BatteryDetail> {
	const res = await apiFetch(`/assets/${assetId}/battery`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch battery detail for asset ${assetId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getServicingEvents(
	assetId: number,
): Promise<ServicingEvent[]> {
	const res = await apiFetch(`/assets/${assetId}/servicing`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch servicing events for asset ${assetId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getAssetMissions(
	assetId: number,
): Promise<GliderDeployment[]> {
	const res = await apiFetch(`/assets/${assetId}/missions`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch missions for asset ${assetId}: ${res.status}`,
		);
	}
	return res.json();
}

export async function getServicingEventTypes(): Promise<
	ServicingEventTypeOption[]
> {
	const res = await apiFetch("/assets/servicing-event-types");
	if (!res.ok) {
		throw new Error(`Failed to fetch servicing event types: ${res.status}`);
	}
	return res.json();
}

export async function getManufacturers(): Promise<LookupOption[]> {
	const res = await apiFetch("/lookups/manufacturers");
	if (!res.ok) {
		throw new Error(`Failed to fetch manufacturers: ${res.status}`);
	}
	return res.json();
}

export async function getRmas(): Promise<RmaCatalogueRow[]> {
	const res = await apiFetch("/rmas");
	if (!res.ok) {
		throw new Error(`Failed to fetch RMAs: ${res.status}`);
	}
	return res.json();
}

export async function getRma(id: number): Promise<Rma | null> {
	const res = await apiFetch(`/rmas/${id}`);
	if (res.status === 404) return null;
	if (!res.ok) {
		throw new Error(`Failed to fetch RMA ${id}: ${res.status}`);
	}
	return res.json();
}

export async function getRmaAssets(id: number): Promise<RmaAsset[]> {
	const res = await apiFetch(`/rmas/${id}/assets`);
	if (!res.ok) {
		throw new Error(`Failed to fetch assets for RMA ${id}: ${res.status}`);
	}
	return res.json();
}

export async function getRmaEvents(id: number): Promise<RmaEvent[]> {
	const res = await apiFetch(`/rmas/${id}/events`);
	if (!res.ok) {
		throw new Error(`Failed to fetch events for RMA ${id}: ${res.status}`);
	}
	return res.json();
}

export async function getAssetRmas(
	assetId: number,
): Promise<AssetRmaSummary[]> {
	const res = await apiFetch(`/assets/${assetId}/rmas`);
	if (!res.ok) {
		throw new Error(`Failed to fetch RMAs for asset ${assetId}: ${res.status}`);
	}
	return res.json();
}

// --- Iridium airtime costs (read-only; see gateway/src/iridium) ---

async function getIridium<T>(path: string): Promise<T> {
	const res = await apiFetch(`/iridium${path}`);
	if (!res.ok) {
		throw new Error(`Failed to fetch iridium ${path}: ${res.status}`);
	}
	return res.json();
}

export const getIridiumSummary = () => getIridium<IridiumSummary>("/summary");
export const getIridiumMissions = () =>
	getIridium<IridiumMissionCost[]>("/missions");
export const getIridiumMission = (missionId: number) =>
	getIridium<IridiumMissionDetail>(`/missions/${missionId}`);
export const getIridiumMonthly = () =>
	getIridium<IridiumMonthlyCost[]>("/monthly");
export const getIridiumGliderMonths = () =>
	getIridium<IridiumGliderMonth[]>("/gliders/monthly");

export async function getAllAssetWear(): Promise<AssetWear[]> {
	const res = await apiFetch("/assets/wear");
	if (!res.ok) {
		throw new Error(`Failed to fetch wear counters: ${res.status}`);
	}
	return res.json();
}

// null when the asset isn't a wear-tracked type.
export async function getAssetWear(assetId: number): Promise<AssetWear | null> {
	const res = await apiFetch(`/assets/${assetId}/wear`);
	if (!res.ok) {
		throw new Error(
			`Failed to fetch wear counters for asset ${assetId}: ${res.status}`,
		);
	}
	const text = await res.text();
	return text ? JSON.parse(text) : null;
}
