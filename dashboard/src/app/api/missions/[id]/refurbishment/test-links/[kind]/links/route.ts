import { proxyToGateway } from "@/lib/gateway-proxy";

// Add a link to a selftest or field test (kind: "selftest" | "field-test").
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string; kind: string }> },
) {
	const { id, kind } = await params;
	return proxyToGateway(
		`/missions/${id}/refurbishment/test-links/${encodeURIComponent(kind)}/links`,
		"POST",
		request,
	);
}
