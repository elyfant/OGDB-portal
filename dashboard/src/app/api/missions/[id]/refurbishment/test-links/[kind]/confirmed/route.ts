import { proxyToGateway } from "@/lib/gateway-proxy";

// Confirm or un-confirm that the test has been done.
export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string; kind: string }> },
) {
	const { id, kind } = await params;
	return proxyToGateway(
		`/missions/${id}/refurbishment/test-links/${encodeURIComponent(kind)}/confirmed`,
		"PUT",
		request,
	);
}
