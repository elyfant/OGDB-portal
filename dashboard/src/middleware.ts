import { SESSION_COOKIE } from "@/lib/session-cookie";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
	const hasSession = request.cookies.has(SESSION_COOKIE);

	if (!hasSession) {
		const loginUrl = new URL("/login", request.url);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
