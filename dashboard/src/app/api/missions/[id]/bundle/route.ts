import { getSessionToken } from "@/lib/auth";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

// Mission data bundle summary (docs/mission-data-bundle.md §8.1): whether a
// bundle exists, whether it's stale, and the store URLs to open.
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const token = await getSessionToken();
	if (!token) {
		return NextResponse.json({ message: "Not signed in." }, { status: 401 });
	}

	const { id } = await params;
	const res = await fetch(`${API_URL}/missions/${id}/bundle`, {
		headers: { Authorization: `Bearer ${token}` },
		cache: "no-store",
	});

	const data = await res.text();
	return new NextResponse(data, {
		status: res.status,
		headers: { "Content-Type": "application/json" },
	});
}
