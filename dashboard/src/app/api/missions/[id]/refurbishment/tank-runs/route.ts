import { proxyToGateway } from "@/lib/gateway-proxy";

// "Add another run".
export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	return proxyToGateway(`/missions/${id}/refurbishment/tank-runs`, "POST");
}
