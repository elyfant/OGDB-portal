import { proxyToGateway } from "@/lib/gateway-proxy";

// Unlock a cleared logsheet. Withdraws the clearance; the body carries the
// reason.
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	return proxyToGateway(
		`/missions/${id}/refurbishment/unlock`,
		"POST",
		request,
	);
}
