import { proxyToGateway } from "@/lib/gateway-proxy";

// Clear the glider for deployment: records who, and locks the logsheet.
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	return proxyToGateway(`/missions/${id}/refurbishment/clear`, "POST");
}
