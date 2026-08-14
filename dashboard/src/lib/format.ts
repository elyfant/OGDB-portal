import type { ChipProps } from "@mui/material/Chip";

export function statusColor(status: string | null): ChipProps["color"] {
	if (status === "active" || status === "recovered") return "success";
	if (status === "scheduled") return "warning";
	if (status === "killed in action" || status === "missing in action")
		return "error";
	return "default";
}

export function formatDate(value: string | null): string {
	if (!value) return "—";
	return new Date(value).toLocaleDateString("en-GB", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function formatUsd(value: number | null): string {
	if (value === null) return "—";
	return value.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
	});
}
