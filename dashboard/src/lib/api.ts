import "server-only";
import type {
	Asset,
	AssetStatusOption,
	Cruise,
	DatasetProcessingDetail,
	DatasetProcessingStatus,
	Glider,
	GliderBuild,
	Mission,
	MissionsLeaderboard,
	MissionsSummary,
	OgdbUser,
	ProcessingPackage,
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
