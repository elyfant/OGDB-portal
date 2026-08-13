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
