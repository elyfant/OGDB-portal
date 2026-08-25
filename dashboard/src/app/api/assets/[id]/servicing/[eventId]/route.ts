import { getSessionToken } from "@/lib/auth";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string; eventId: string }> },
) {
	const token = await getSessionToken();
	if (!token) {
		return NextResponse.json({ message: "Not signed in." }, { status: 401 });
	}

	const { id, eventId } = await params;
	const contentType = request.headers.get("content-type") ?? "";
	const body = await request.arrayBuffer();
	const res = await fetch(`${API_URL}/assets/${id}/servicing/${eventId}`, {
		method: "PATCH",
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
