import "server-only";
import type { AuthUser } from "@ogdb/types";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./session-cookie";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function getSessionToken(): Promise<string | undefined> {
	const store = await cookies();
	return store.get(SESSION_COOKIE)?.value;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
	const token = await getSessionToken();
	if (!token) return null;

	const res = await fetch(`${API_URL}/auth/me`, {
		headers: { Authorization: `Bearer ${token}` },
		cache: "no-store",
	});
	if (!res.ok) return null;
	return res.json();
}
