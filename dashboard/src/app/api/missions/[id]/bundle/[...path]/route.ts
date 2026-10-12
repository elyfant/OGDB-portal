import { getSessionToken } from "@/lib/auth";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

// Response headers passed through from the gateway. Cache-Control matters
// most: store URLs carry the build id, so the gateway marks every file
// immutable and the browser never asks twice (§8.2).
const PASS_THROUGH = ["content-type", "cache-control", "etag", "last-modified"];

// Zarr store files (docs/mission-data-bundle.md §8.2): zarr.json and binary
// chunks, requested by the browser's Zarr reader under the publicStoreUrl /
// staffStoreUrl from the summary, e.g.
//   /api/missions/23/bundle/<buildId>/public.zarr/temperature/c/0/0
//
// Unlike the other routes here, the body is streamed through untouched
// (res.body), never read as text -- text decoding corrupts binary chunks --
// and not buffered either, so large chunks start arriving straight away.
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string; path: string[] }> },
) {
	const token = await getSessionToken();
	if (!token) {
		return NextResponse.json({ message: "Not signed in." }, { status: 401 });
	}

	const { id, path } = await params;
	const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
	const ifNoneMatch = request.headers.get("if-none-match");
	if (ifNoneMatch) {
		headers["If-None-Match"] = ifNoneMatch;
		// Without this, Node's fetch adds "Cache-Control: no-cache" to any
		// conditional request (Fetch standard), and Express then always
		// answers 200 with the full file instead of 304.
		headers["Cache-Control"] = "max-age=0";
	}

	const res = await fetch(
		`${API_URL}/missions/${encodeURIComponent(id)}/bundle/${path.map(encodeURIComponent).join("/")}`,
		{ headers, cache: "no-store" },
	);

	const out = new Headers();
	for (const name of PASS_THROUGH) {
		const value = res.headers.get(name);
		if (value) out.set(name, value);
	}
	// 304 (browser cache still valid) and 404 (a Zarr key that doesn't
	// exist = all fill value) are normal answers, passed on as they are.
	return new NextResponse(res.status === 304 ? null : res.body, {
		status: res.status,
		headers: out,
	});
}
