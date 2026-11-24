import { proxyToGateway } from "@/lib/gateway-proxy";

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string; position: string }> },
) {
	const { id, position } = await params;
	return proxyToGateway(
		`/missions/${id}/refurbishment/batteries/packs/${encodeURIComponent(position)}`,
		"PUT",
		request,
	);
}
