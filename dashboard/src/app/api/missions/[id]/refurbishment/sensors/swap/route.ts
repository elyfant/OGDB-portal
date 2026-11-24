import { proxyToGateway } from "@/lib/gateway-proxy";

// Put a sensor in: replace one, or add when the slot was empty. Also changes
// the mission's build.
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	return proxyToGateway(
		`/missions/${id}/refurbishment/sensors/swap`,
		"POST",
		request,
	);
}
