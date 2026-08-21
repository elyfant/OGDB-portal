"use client";

import type {
	ApplyBuildChangesInput,
	ApplyDatasetStagesInput,
	AssetSearchResult,
	CreateMissionInput,
	CreatedMission,
	DatasetProcessingDetail,
	GliderBuild,
	Mission,
	NewProcessingPackageInput,
	NewProcessingPackageVersionInput,
	ProcessingPackage,
	ProcessingPackageVersion,
	RecordSensorCalibrationInput,
	UpdateExternalReferencesInput,
	UpdateMissionFolderPathInput,
} from "@ogdb/types";

export async function getGliderBuildClient(
	gliderId: number,
): Promise<GliderBuild> {
	const res = await fetch(`/api/gliders/${gliderId}/build`);
	if (!res.ok) {
		throw new Error(`Failed to fetch glider build: ${res.status}`);
	}
	return res.json();
}

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

export async function recordCalibration(
	assetId: number,
	input: RecordSensorCalibrationInput,
	certificate?: File,
): Promise<void> {
	// Always multipart -- even with no file, so the proxy route and the
	// gateway endpoint only ever have to handle one request shape.
	// coefficients rides along as a JSON-stringified field (matching
	// RecordSensorCalibrationDto's Transform) since multipart/form-data
	// can't nest a real object in one field.
	const formData = new FormData();
	formData.append("calDate", input.calDate);
	formData.append("coefficients", JSON.stringify(input.coefficients));
	if (certificate) formData.append("certificate", certificate);

	const res = await fetch(`/api/assets/${assetId}/calibrations`, {
		method: "POST",
		body: formData,
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to record calibration: ${res.status}`,
		);
	}
}

export async function updateCalibration(
	assetId: number,
	calId: number,
	input: RecordSensorCalibrationInput,
	certificate?: File,
): Promise<void> {
	const formData = new FormData();
	formData.append("calDate", input.calDate);
	formData.append("coefficients", JSON.stringify(input.coefficients));
	if (certificate) formData.append("certificate", certificate);

	const res = await fetch(`/api/assets/${assetId}/calibrations/${calId}`, {
		method: "PATCH",
		body: formData,
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to update calibration: ${res.status}`,
		);
	}
}

export async function createMission(
	input: CreateMissionInput,
): Promise<CreatedMission> {
	const res = await fetch("/api/missions", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to create mission: ${res.status}`);
	}
	return res.json();
}

export async function updateMission(
	id: number,
	input: CreateMissionInput,
): Promise<CreatedMission> {
	const res = await fetch(`/api/missions/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to update mission: ${res.status}`);
	}
	return res.json();
}

export async function updateMissionFolderPath(
	missionId: number,
	input: UpdateMissionFolderPathInput,
): Promise<Mission> {
	const res = await fetch(`/api/missions/${missionId}/folder-path`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to update mission folder path: ${res.status}`,
		);
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
