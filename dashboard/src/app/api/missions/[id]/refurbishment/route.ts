import { getSessionToken } from "@/lib/auth";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

// Starts the mission's refurbishment logsheet (POST). Reading goes through
// the server-side getRefurbishment, not this route.
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const token = await getSessionToken();
	if (!token) {
		return NextResponse.json({ message: "Not signed in." }, { status: 401 });
	}

	const { id } = await params;
	const res = await fetch(`${API_URL}/missions/${id}/refurbishment`, {
		method: "POST",
		headers: { Authorization: `Bearer ${token}` },
	});

	const data = await res.text();
	return new NextResponse(data, {
		status: res.status,
		headers: { "Content-Type": "application/json" },
	});
}
