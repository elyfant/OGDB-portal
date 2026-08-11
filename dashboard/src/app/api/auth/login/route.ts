import { SESSION_COOKIE } from "@/lib/session-cookie";
import type { LoginResponse } from "@ogdb/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";
const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;

export async function POST(request: Request) {
	const body = await request.text();

	const gatewayRes = await fetch(`${API_URL}/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body,
	});

	if (!gatewayRes.ok) {
		const data = await gatewayRes.text();
		return new NextResponse(data, {
			status: gatewayRes.status,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { token, user }: LoginResponse = await gatewayRes.json();
	const store = await cookies();
	store.set(SESSION_COOKIE, token, {
		httpOnly: true,
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
		path: "/",
		maxAge: SEVEN_DAYS_SECONDS,
	});

	return NextResponse.json({ user });
}
