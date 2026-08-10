import type { Glider } from "@ogdb/types";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function getGliders(): Promise<Glider[]> {
	const res = await fetch(`${API_URL}/gliders`, { cache: "no-store" });
	if (!res.ok) {
		throw new Error(`Failed to fetch gliders: ${res.status}`);
	}
	return res.json();
}
