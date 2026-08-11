"use client";

export async function setGliderStatus(
	gliderId: number,
	statusId: number,
): Promise<void> {
	const res = await fetch(`/api/gliders/${gliderId}/status`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ statusId }),
	});
	if (!res.ok) {
		throw new Error(`Failed to update status: ${res.status}`);
	}
}
