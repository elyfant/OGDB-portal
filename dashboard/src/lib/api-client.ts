"use client";

import type {
	ApplyBuildChangesInput,
	ApplyDatasetStagesInput,
	Asset,
	AssetSearchResult,
	ConfirmErddapPushInput,
	CreateAssetInput,
	CreateCruiseInput,
	CreateGliderInput,
	CreateMissionInput,
	CreatedMission,
	Cruise,
	DatasetProcessingDetail,
	Glider,
	GliderBuild,
	Mission,
	NewProcessingPackageInput,
	NewProcessingPackageVersionInput,
	ParsedCertificate,
	ProcessingPackage,
	ProcessingPackageVersion,
	RecordSensorCalibrationInput,
	RecordServicingEventInput,
	UpdateAssetInput,
	UpdateExternalReferencesInput,
	UpdateGliderInput,
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

export async function confirmErddapPush(
	missionId: number,
	input: ConfirmErddapPushInput,
): Promise<DatasetProcessingDetail> {
	const res = await fetch(`/api/datasets/${missionId}/erddap-status`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to confirm ERDDAP push: ${res.status}`,
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

// Read-only preview -- doesn't save anything, just scrapes the PDF for
// coefficients/facility/date so the dialog can populate its fields.
// assetId only picks which route to hit; the parser itself doesn't use
// it (parsing isn't asset-specific).
export async function parseCertificate(
	assetId: number,
	certificate: File,
): Promise<ParsedCertificate> {
	const formData = new FormData();
	formData.append("certificate", certificate);

	const res = await fetch(
		`/api/assets/${assetId}/calibrations/parse-certificate`,
		{ method: "POST", body: formData },
	);
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to read certificate: ${res.status}`,
		);
	}
	return res.json();
}

// Same multipart-always convention as recordCalibration -- an optional
// attachment can ride along, so the proxy route and gateway endpoint
// only ever handle one request shape. Fields not present in the DTO
// (endDate/performedByContactId when unset) are simply omitted rather
// than appended as empty strings, since RecordServicingEventDto treats
// "" and "not sent" the same way but omitting is clearer at the call site.
function servicingFormData(
	input: RecordServicingEventInput,
	attachment?: File,
): FormData {
	const formData = new FormData();
	formData.append("eventType", input.eventType);
	formData.append("title", input.title);
	formData.append("startDate", input.startDate);
	if (input.endDate) formData.append("endDate", input.endDate);
	if (input.performedByContactId != null) {
		formData.append("performedByContactId", String(input.performedByContactId));
	}
	if (input.details) formData.append("details", input.details);
	if (attachment) formData.append("attachment", attachment);
	return formData;
}

export async function recordServicingEvent(
	assetId: number,
	input: RecordServicingEventInput,
	attachment?: File,
): Promise<void> {
	const res = await fetch(`/api/assets/${assetId}/servicing`, {
		method: "POST",
		body: servicingFormData(input, attachment),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to record servicing event: ${res.status}`,
		);
	}
}

export async function updateServicingEvent(
	assetId: number,
	eventId: number,
	input: RecordServicingEventInput,
	attachment?: File,
): Promise<void> {
	const res = await fetch(`/api/assets/${assetId}/servicing/${eventId}`, {
		method: "PATCH",
		body: servicingFormData(input, attachment),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to update servicing event: ${res.status}`,
		);
	}
}

export async function createGlider(input: CreateGliderInput): Promise<Glider> {
	const res = await fetch("/api/gliders", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to create glider: ${res.status}`);
	}
	return res.json();
}

export async function updateGlider(
	id: number,
	input: UpdateGliderInput,
): Promise<Glider> {
	const res = await fetch(`/api/gliders/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to update glider: ${res.status}`);
	}
	return res.json();
}

export async function createAsset(input: CreateAssetInput): Promise<Asset> {
	const res = await fetch("/api/assets", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to create asset: ${res.status}`);
	}
	return res.json();
}

export async function updateAsset(
	id: number,
	input: UpdateAssetInput,
): Promise<Asset> {
	const res = await fetch(`/api/assets/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to update asset: ${res.status}`);
	}
	return res.json();
}

export async function createCruise(input: CreateCruiseInput): Promise<Cruise> {
	const res = await fetch("/api/cruises", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to create cruise: ${res.status}`);
	}
	return res.json();
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
