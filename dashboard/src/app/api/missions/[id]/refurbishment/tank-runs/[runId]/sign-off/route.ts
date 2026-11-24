import { proxyToGateway } from "@/lib/gateway-proxy";

export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string; runId: string }> },
) {
	const { id, runId } = await params;
	return proxyToGateway(
		`/missions/${id}/refurbishment/tank-runs/${runId}/sign-off`,
		"POST",
	);
}
