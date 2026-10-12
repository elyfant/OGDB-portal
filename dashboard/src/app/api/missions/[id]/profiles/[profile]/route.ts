import { getSessionToken } from "@/lib/auth";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

// One profile at full resolution, from ERDDAP via the gateway
// (docs/mission-data-bundle.md §8.3). ?variables= is passed through.
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string; profile: string }> },
) {
	const token = await getSessionToken();
	if (!token) {
		return NextResponse.json({ message: "Not signed in." }, { status: 401 });
	}

	const { id, profile } = await params;
	const { search } = new URL(request.url);
	const res = await fetch(
		`${API_URL}/missions/${encodeURIComponent(id)}/profiles/${encodeURIComponent(profile)}${search}`,
		{ headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
	);

	const data = await res.text();
	return new NextResponse(data, {
		status: res.status,
		headers: { "Content-Type": "application/json" },
	});
}
