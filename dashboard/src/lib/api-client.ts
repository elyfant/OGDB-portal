"use client";

import type {
	ApplyBuildChangesInput,
	ApplyDatasetStagesInput,
	AssetSearchResult,
	DatasetProcessingDetail,
	GliderBuild,
	NewProcessingPackageInput,
	NewProcessingPackageVersionInput,
	ProcessingPackage,
	ProcessingPackageVersion,
	UpdateExternalReferencesInput,
} from "@ogdb/types";

export async function searchAssets(
	type: string,
	q: string,
): Promise<AssetSearchResult[]> {
	const params = new URLSearchParams({ type, q });
	const res = await fetch(`/api/assets/search?${params}`);
	if (!res.ok) {
		throw new Error(`Failed to search assets: ${res.status}`);
	}
	return res.json();
}

export async function applyBuildChanges(
	gliderId: number,
	input: ApplyBuildChangesInput,
): Promise<GliderBuild> {
	const res = await fetch(`/api/gliders/${gliderId}/build-changes`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to save build changes: ${res.status}`,
		);
	}
	return res.json();
}

export async function applyDatasetStages(
	missionId: number,
	input: ApplyDatasetStagesInput,
): Promise<DatasetProcessingDetail> {
	const res = await fetch(`/api/datasets/${missionId}/stages`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to save processing status: ${res.status}`,
		);
	}
	return res.json();
}

export async function updateExternalReferences(
	missionId: number,
	input: UpdateExternalReferencesInput,
): Promise<DatasetProcessingDetail> {
	const res = await fetch(`/api/datasets/${missionId}/references`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to save external references: ${res.status}`,
		);
	}
	return res.json();
}

export async function createProcessingPackage(
	input: NewProcessingPackageInput,
): Promise<ProcessingPackage> {
	const res = await fetch("/api/processing-packages", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to create package: ${res.status}`);
	}
	return res.json();
}

export async function createProcessingPackageVersion(
	packageId: number,
	input: NewProcessingPackageVersionInput,
): Promise<ProcessingPackageVersion> {
	const res = await fetch(`/api/processing-packages/${packageId}/versions`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to create version: ${res.status}`);
	}
	return res.json();
}

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
