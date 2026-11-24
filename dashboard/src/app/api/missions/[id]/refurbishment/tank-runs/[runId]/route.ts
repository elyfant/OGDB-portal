import { proxyToGateway } from "@/lib/gateway-proxy";

type Ctx = { params: Promise<{ id: string; runId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
	const { id, runId } = await params;
	return proxyToGateway(
		`/missions/${id}/refurbishment/tank-runs/${runId}`,
		"PATCH",
		request,
	);
}

export async function DELETE(_request: Request, { params }: Ctx) {
	const { id, runId } = await params;
	return proxyToGateway(
		`/missions/${id}/refurbishment/tank-runs/${runId}`,
		"DELETE",
	);
}
