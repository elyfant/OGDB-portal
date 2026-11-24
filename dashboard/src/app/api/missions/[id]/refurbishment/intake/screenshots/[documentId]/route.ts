import { proxyToGateway } from "@/lib/gateway-proxy";

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string; documentId: string }> },
) {
	const { id, documentId } = await params;
	return proxyToGateway(
		`/missions/${id}/refurbishment/intake/screenshots/${documentId}`,
		"DELETE",
	);
}
