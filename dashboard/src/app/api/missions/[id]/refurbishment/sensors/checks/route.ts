import { proxyToGateway } from "@/lib/gateway-proxy";

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	return proxyToGateway(
		`/missions/${id}/refurbishment/sensors/checks`,
		"PUT",
		request,
	);
}
