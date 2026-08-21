import { getSessionToken } from "@/lib/auth";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const token = await getSessionToken();
	if (!token) {
		return NextResponse.json({ message: "Not signed in." }, { status: 401 });
	}

	const { id } = await params;
	// Multipart now (an optional certificate file rides alongside the
	// calibration data) -- buffered rather than streamed through, since a
	// PDF certificate is small enough that this is simpler than dealing
	// with fetch's `duplex` requirement for streaming request bodies.
	// The original Content-Type (with its multipart boundary) has to be
	// forwarded as-is; generating a new one would lose the boundary.
	const contentType = request.headers.get("content-type") ?? "";
	const body = await request.arrayBuffer();
	const res = await fetch(`${API_URL}/assets/${id}/calibrations`, {
		method: "POST",
		headers: {
			"Content-Type": contentType,
			Authorization: `Bearer ${token}`,
		},
		body,
	});

	const data = await res.text();
	return new NextResponse(data, {
		status: res.status,
		headers: { "Content-Type": "application/json" },
	});
}
