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
	// Multipart -- new file uploads plus a "deleteIds" field. Same
	// buffered-forward approach as the calibrations/servicing routes: the
	// original Content-Type (with its multipart boundary) has to be
	// forwarded as-is.
	const contentType = request.headers.get("content-type") ?? "";
	const body = await request.arrayBuffer();
	const res = await fetch(`${API_URL}/missions/${id}/files`, {
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
