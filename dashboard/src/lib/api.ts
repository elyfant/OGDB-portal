import "server-only";
import type {
	AssetStatusOption,
	Glider,
	Mission,
	MissionsLeaderboard,
	MissionsSummary,
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
