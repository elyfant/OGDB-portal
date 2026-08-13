"use client";

export async function setStatus(
	kind: "gliders" | "assets",
	id: number,
	statusId: number,
): Promise<void> {
	const res = await fetch(`/api/${kind}/${id}/status`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ statusId }),
	});
	if (!res.ok) {
		throw new Error(`Failed to update status: ${res.status}`);
	}
}
