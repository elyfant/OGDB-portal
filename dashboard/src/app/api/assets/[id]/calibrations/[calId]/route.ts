import { getSessionToken } from "@/lib/auth";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string; calId: string }> },
) {
	const token = await getSessionToken();
	if (!token) {
		return NextResponse.json({ message: "Not signed in." }, { status: 401 });
	}

	const { id, calId } = await params;
	// Same multipart-forwarding approach as the create route -- buffered,
	// original Content-Type (with its boundary) passed through as-is.
	const contentType = request.headers.get("content-type") ?? "";
	const body = await request.arrayBuffer();
	const res = await fetch(`${API_URL}/assets/${id}/calibrations/${calId}`, {
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
