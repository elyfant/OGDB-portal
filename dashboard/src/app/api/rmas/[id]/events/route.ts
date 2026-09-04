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
	// Multipart -- an optional PDF attachment (AWB, commercial invoice,
	// repair report) rides alongside the event data. Same buffered-forward
	// approach as the servicing route: the original Content-Type (with
	// its multipart boundary) has to be forwarded as-is.
	const contentType = request.headers.get("content-type") ?? "";
	const body = await request.arrayBuffer();
	const res = await fetch(`${API_URL}/rmas/${id}/events`, {
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
