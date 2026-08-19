import { getSessionToken } from "@/lib/auth";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function GET(request: Request) {
	const token = await getSessionToken();
	if (!token) {
		return NextResponse.json({ message: "Not signed in." }, { status: 401 });
	}

	const { search } = new URL(request.url);
	const res = await fetch(`${API_URL}/assets/search${search}`, {
		headers: { Authorization: `Bearer ${token}` },
		cache: "no-store",
	});

	const data = await res.text();
	return new NextResponse(data, {
		status: res.status,
		headers: { "Content-Type": "application/json" },
	});
}
