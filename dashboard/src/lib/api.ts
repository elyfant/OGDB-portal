import type { AssetStatusOption, Glider, Mission } from "@ogdb/types";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function getGliders(): Promise<Glider[]> {
	const res = await fetch(`${API_URL}/gliders`, { cache: "no-store" });
	if (!res.ok) {
		throw new Error(`Failed to fetch gliders: ${res.status}`);
	}
	return res.json();
}

export async function getStatusOptions(): Promise<AssetStatusOption[]> {
	const res = await fetch(`${API_URL}/asset-status-options`, {
		cache: "no-store",
	});
	if (!res.ok) {
		throw new Error(`Failed to fetch status options: ${res.status}`);
	}
	return res.json();
}

export async function getMissions(): Promise<Mission[]> {
	const res = await fetch(`${API_URL}/missions`, { cache: "no-store" });
	if (!res.ok) {
		throw new Error(`Failed to fetch missions: ${res.status}`);
	}
	return res.json();
}
