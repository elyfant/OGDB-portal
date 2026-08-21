import { getSessionToken } from "@/lib/auth";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const token = await getSessionToken();
	if (!token) {
		return NextResponse.json({ message: "Not signed in." }, { status: 401 });
	}

	const { id } = await params;
	const res = await fetch(`${API_URL}/documents/${id}/file`, {
		headers: { Authorization: `Bearer ${token}` },
		cache: "no-store",
	});

	const body = await res.arrayBuffer();
	return new NextResponse(body, {
		status: res.status,
		headers: {
			"Content-Type": res.headers.get("content-type") ?? "application/pdf",
			"Content-Disposition": res.headers.get("content-disposition") ?? "",
		},
	});
}
