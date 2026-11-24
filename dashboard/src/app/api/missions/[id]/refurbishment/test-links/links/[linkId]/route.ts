import { proxyToGateway } from "@/lib/gateway-proxy";

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string; linkId: string }> },
) {
	const { id, linkId } = await params;
	return proxyToGateway(
		`/missions/${id}/refurbishment/test-links/links/${linkId}`,
		"DELETE",
	);
}
