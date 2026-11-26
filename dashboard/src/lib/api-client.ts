"use client";

import type {
	ApplyBuildChangesInput,
	ApplyBuildChangesResult,
	ApplyDatasetStagesInput,
	Asset,
	AssetSearchResult,
	ConfirmErddapPushInput,
	CreateAssetInput,
	CreateCruiseInput,
	CreateGliderInput,
	CreateLocationInput,
	CreateMissionInput,
	CreateRmaInput,
	CreatedMission,
	Cruise,
	DatasetProcessingDetail,
	DecommissionInput,
	DeleteServicingEventResult,
	Glider,
	GliderBuild,
	LinkRmaAssetInput,
	Location,
	Mission,
	MissionFilesSaveResult,
	NewProcessingPackageInput,
	NewProcessingPackageVersionInput,
	ParsedCertificate,
	ProcessingPackage,
	ProcessingPackageVersion,
	RecordAssetLocationInput,
	RecordBatteryMeasurementInput,
	RecordRmaEventInput,
	RecordSensorCalibrationInput,
	RecordServicingEventInput,
	RefurbBatteries,
	RefurbDeviceTests,
	RefurbFinalPrep,
	RefurbInspection,
	RefurbIntake,
	RefurbSensors,
	RefurbSoftware,
	RefurbTestLinks,
	RefurbVacuum,
	Refurbishment,
	ResolveServicingRequiredInput,
	Rma,
	RmaAsset,
	TankRun,
	UpdateAssetInput,
	UpdateExternalReferencesInput,
	UpdateGliderInput,
	UpdateLocationInput,
	UpdateMissionInput,
	UpdateRmaAssetReasonInput,
	UpdateRmaInput,
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

// Edits one mission's build. Resolves with any overlap warnings (e.g. a
// sensor also in another glider's open build) -- the save itself went through.
export async function applyMissionBuildChanges(
	missionId: number,
	input: ApplyBuildChangesInput,
): Promise<ApplyBuildChangesResult> {
	const res = await fetch(`/api/missions/${missionId}/build-changes`, {
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

// Replaces a mission's build with a copy of another mission's (same glider).
export async function copyMissionBuild(
	missionId: number,
	sourceMissionId: number,
): Promise<ApplyBuildChangesResult> {
	const res = await fetch(`/api/missions/${missionId}/build/copy`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ sourceMissionId }),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to copy build: ${res.status}`);
	}
	return res.json();
}

// Starts the glider's workshop mission (the glider being prepared).
export async function createWorkshop(
	gliderId: number,
): Promise<CreatedMission> {
	const res = await fetch(`/api/gliders/${gliderId}/workshop`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: "{}",
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to start workshop: ${res.status}`);
	}
	return res.json();
}

async function clearanceCall(
	missionId: number,
	path: "/clear" | "/unlock",
	body?: Record<string, unknown>,
): Promise<Refurbishment> {
	const res = await fetch(
		`/api/missions/${missionId}/refurbishment${path}`,
		body
			? {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ values: body }),
				}
			: { method: "POST" },
	);
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		const msg = Array.isArray(data?.message)
			? data.message.join(" ")
			: data?.message;
		throw new Error(msg ?? `Request failed: ${res.status}`);
	}
	return res.json();
}

// Clears the glider for deployment and locks the logsheet. Only works when
// every required section is done.
export const clearRefurbishment = (missionId: number) =>
	clearanceCall(missionId, "/clear");

// Unlocks a cleared logsheet. Withdraws the clearance; needs a reason.
export const unlockRefurbishment = (missionId: number, reason: string) =>
	clearanceCall(missionId, "/unlock", { reason });

// Starts the refurbishment logsheet on a workshop or scheduled mission.
export async function startRefurbishment(
	missionId: number,
): Promise<Refurbishment> {
	const res = await fetch(`/api/missions/${missionId}/refurbishment`, {
		method: "POST",
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to start refurbishment: ${res.status}`,
		);
	}
	return res.json();
}

async function putRefurbBatteries(
	missionId: number,
	path: string,
	values: Record<string, unknown>,
): Promise<RefurbBatteries> {
	const res = await fetch(
		`/api/missions/${missionId}/refurbishment/batteries${path}`,
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ values }),
		},
	);
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		const msg = Array.isArray(data?.message)
			? data.message.join(" ")
			: data?.message;
		throw new Error(msg ?? `Battery request failed: ${res.status}`);
	}
	return res.json();
}

export const saveBatteryPack = (
	missionId: number,
	position: string,
	values: Record<string, unknown>,
) => putRefurbBatteries(missionId, `/packs/${position}`, values);

export const saveBatteryChecks = (
	missionId: number,
	values: Record<string, unknown>,
) => putRefurbBatteries(missionId, "/checks", values);

// Saves the changed device results in one go. A fail needs a note.
export async function saveDeviceTests(
	missionId: number,
	tests: { key: string; result: "pass" | "fail" | null; note: string | null }[],
): Promise<RefurbDeviceTests> {
	const res = await fetch(
		`/api/missions/${missionId}/refurbishment/device-tests`,
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ values: { tests } }),
		},
	);
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		const msg = Array.isArray(data?.message)
			? data.message.join(" ")
			: data?.message;
		throw new Error(msg ?? `Device test request failed: ${res.status}`);
	}
	return res.json();
}

// Saves the Software track: the sim-dive and mission-file fields, plus the
// cleanup ticks that changed.
export async function saveRefurbSoftware(
	missionId: number,
	values: Record<string, unknown>,
): Promise<RefurbSoftware> {
	const res = await fetch(`/api/missions/${missionId}/refurbishment/software`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ values }),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		const msg = Array.isArray(data?.message)
			? data.message.join(" ")
			: data?.message;
		throw new Error(msg ?? `Software track request failed: ${res.status}`);
	}
	return res.json();
}

async function sensorsCall(
	missionId: number,
	path: string,
	method: "POST" | "PUT",
	values: Record<string, unknown>,
): Promise<RefurbSensors> {
	const res = await fetch(
		`/api/missions/${missionId}/refurbishment/sensors${path}`,
		{
			method,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ values }),
		},
	);
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		const msg = Array.isArray(data?.message)
			? data.message.join(" ")
			: data?.message;
		throw new Error(msg ?? `Sensor request failed: ${res.status}`);
	}
	return res.json();
}

// Puts a sensor in this mission's build: replaces `oldAssetId`, or adds one
// when it is null. The logsheet and the build change together.
export const swapRefurbSensor = (
	missionId: number,
	oldAssetId: number | null,
	newAssetId: number,
) => sensorsCall(missionId, "/swap", "POST", { oldAssetId, newAssetId });

export const saveSensorChecks = (
	missionId: number,
	checks: {
		assetId: number;
		reviewed: boolean;
		coefficientsOk: boolean;
		zeroFrequencyOk: boolean;
		needsCalibration: boolean;
		notes: string | null;
	}[],
) => sensorsCall(missionId, "/checks", "PUT", { checks });

async function testLinksCall(
	missionId: number,
	path: string,
	init: RequestInit,
): Promise<RefurbTestLinks> {
	const res = await fetch(
		`/api/missions/${missionId}/refurbishment/test-links${path}`,
		init,
	);
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		const msg = Array.isArray(data?.message)
			? data.message.join(" ")
			: data?.message;
		throw new Error(msg ?? `Request failed: ${res.status}`);
	}
	return res.json();
}

// Selftests and field tests live in their own software; the logsheet links to
// them. `kind` is the URL form: "selftest" or "field-test".
export type TestKindPath = "selftest" | "field-test";

export const addTestLink = (
	missionId: number,
	kind: TestKindPath,
	url: string,
	label: string | null,
) =>
	testLinksCall(missionId, `/${kind}/links`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ values: { url, label } }),
	});

export const removeTestLink = (missionId: number, linkId: number) =>
	testLinksCall(missionId, `/links/${linkId}`, { method: "DELETE" });

export const setTestConfirmed = (
	missionId: number,
	kind: TestKindPath,
	confirmed: boolean,
) =>
	testLinksCall(missionId, `/${kind}/confirmed`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ values: { confirmed } }),
	});

// One call to a logsheet section that carries an Argos tag (intake and final
// prep). `section` is its path under /refurbishment.
async function sectionCall<T>(
	missionId: number,
	section: "intake" | "final-prep",
	path: string,
	init: RequestInit,
): Promise<T> {
	const res = await fetch(
		`/api/missions/${missionId}/refurbishment/${section}${path}`,
		init,
	);
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		const msg = Array.isArray(data?.message)
			? data.message.join(" ")
			: data?.message;
		throw new Error(msg ?? `Request failed: ${res.status}`);
	}
	return res.json();
}

const finalPrepCall = (missionId: number, path: string, init: RequestInit) =>
	sectionCall<RefurbFinalPrep>(missionId, "final-prep", path, init);

const intakeCall = (missionId: number, path: string, init: RequestInit) =>
	sectionCall<RefurbIntake>(missionId, "intake", path, init);

// Saves the whole Intake section.
export const saveRefurbIntake = (
	missionId: number,
	values: Record<string, unknown>,
) =>
	intakeCall(missionId, "", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ values }),
	});

// Saves the whole Final prep section. Choosing a different Argos tag also
// changes the mission's build.
export const saveRefurbFinalPrep = (
	missionId: number,
	values: Record<string, unknown>,
) =>
	finalPrepCall(missionId, "", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ values }),
	});

// Saves the changed inspection lines in one go. Needs work and repaired
// must carry a note.
export async function saveRefurbInspection(
	missionId: number,
	items: {
		key: string;
		status: "ok" | "issue" | "repaired" | "done" | null;
		note: string | null;
	}[],
): Promise<RefurbInspection> {
	const res = await fetch(
		`/api/missions/${missionId}/refurbishment/inspection`,
		{
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ values: { items } }),
		},
	);
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		const msg = Array.isArray(data?.message)
			? data.message.join(" ")
			: data?.message;
		throw new Error(msg ?? `Inspection request failed: ${res.status}`);
	}
	return res.json();
}

// Saves the whole Close and vacuum section.
export async function saveRefurbVacuum(
	missionId: number,
	values: Record<string, unknown>,
): Promise<RefurbVacuum> {
	const res = await fetch(`/api/missions/${missionId}/refurbishment/vacuum`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ values }),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		const msg = Array.isArray(data?.message)
			? data.message.join(" ")
			: data?.message;
		throw new Error(msg ?? `Close and vacuum request failed: ${res.status}`);
	}
	return res.json();
}

async function tankRunCall<T>(
	missionId: number,
	path: string,
	method: "POST" | "PATCH" | "DELETE",
	body?: unknown,
): Promise<T> {
	const res = await fetch(
		`/api/missions/${missionId}/refurbishment/tank-runs${path}`,
		{
			method,
			headers: body ? { "Content-Type": "application/json" } : undefined,
			body: body ? JSON.stringify(body) : undefined,
		},
	);
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		const msg = Array.isArray(data?.message)
			? data.message.join(" ")
			: data?.message;
		throw new Error(msg ?? `Tank run request failed: ${res.status}`);
	}
	return (res.status === 204 ? undefined : await res.json()) as T;
}

export const addTankRun = (missionId: number) =>
	tankRunCall<TankRun>(missionId, "", "POST");

export const saveTankRun = (
	missionId: number,
	runId: number,
	values: Record<string, unknown>,
) => tankRunCall<TankRun>(missionId, `/${runId}`, "PATCH", { values });

export const signOffTankRun = (missionId: number, runId: number) =>
	tankRunCall<TankRun>(missionId, `/${runId}/sign-off`, "POST");

export const deleteTankRun = (missionId: number, runId: number) =>
	tankRunCall<void>(missionId, `/${runId}`, "DELETE");

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
	if (input.closeMissionId != null) {
		formData.append("closeMissionId", String(input.closeMissionId));
		formData.append(
			"closeMissionSetEndDate",
			String(input.closeMissionSetEndDate === true),
		);
	}
	if (input.childAssetIds?.length) {
		formData.append("childAssetIds", JSON.stringify(input.childAssetIds));
	}
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

// The repair is done: takes the "servicing required" flag off. The event stays
// on the timeline as a closed span.
export async function resolveServicingRequired(
	assetId: number,
	eventId: number,
	input: ResolveServicingRequiredInput,
): Promise<void> {
	const res = await fetch(
		`/api/assets/${assetId}/servicing/${eventId}/resolve`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(input),
		},
	);
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to resolve flag: ${res.status}`);
	}
}

// Deletes an event logged by mistake (its attachments go with it).
export async function deleteServicingEvent(
	assetId: number,
	eventId: number,
): Promise<DeleteServicingEventResult> {
	const res = await fetch(`/api/assets/${assetId}/servicing/${eventId}`, {
		method: "DELETE",
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to delete servicing event: ${res.status}`,
		);
	}
	return res.json();
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

export async function uploadBatteryModelSds(
	modelId: number,
	file: File,
): Promise<void> {
	const form = new FormData();
	form.append("sds", file);
	const res = await fetch(`/api/battery-models/${modelId}/safety-data-sheet`, {
		method: "POST",
		body: form,
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to upload safety data sheet: ${res.status}`,
		);
	}
}

export async function recordBatteryMeasurement(
	assetId: number,
	input: RecordBatteryMeasurementInput,
): Promise<void> {
	const res = await fetch(`/api/assets/${assetId}/battery/measurements`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to record measurement: ${res.status}`,
		);
	}
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
	input: UpdateMissionInput,
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

// One request carrying both sides of an "Add key mission file" save:
// `newFiles` uploaded, `deleteIds` (documents.id) removed. The gateway
// does both in a transaction and returns the names for the banner.
export async function saveMissionFiles(
	missionId: number,
	newFiles: File[],
	deleteIds: number[],
): Promise<MissionFilesSaveResult> {
	const formData = new FormData();
	for (const file of newFiles) formData.append("files", file);
	formData.append("deleteIds", JSON.stringify(deleteIds));

	const res = await fetch(`/api/missions/${missionId}/files`, {
		method: "POST",
		body: formData,
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to save mission files: ${res.status}`,
		);
	}
	return res.json();
}

// Assets only -- a glider's operational status is derived from its
// timeline, not set (see docs/design/derived-glider-status.md).
export async function setStatus(
	kind: "assets",
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

// Fleet lifecycle. `decommissionedDate: null` returns the asset to
// service. Routed through the assets endpoint (the column is on
// `assets`); gliders are the only asset type that surfaces it today.
export async function decommissionAsset(
	assetId: number,
	input: DecommissionInput,
): Promise<void> {
	const res = await fetch(`/api/assets/${assetId}/decommission`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(
			data?.message ?? `Failed to update decommission status: ${res.status}`,
		);
	}
}

// Active places, fetched on demand by client components that weren't handed
// the list (see the mission dialog's recovery prompt).
export async function getLocationsClient(): Promise<Location[]> {
	const res = await fetch("/api/locations", { cache: "no-store" });
	if (!res.ok) {
		throw new Error(`Failed to load places: ${res.status}`);
	}
	return res.json();
}

// The shared list of places (Locations page).
export async function createLocation(
	input: CreateLocationInput,
): Promise<Location> {
	const res = await fetch("/api/locations", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to add place: ${res.status}`);
	}
	return res.json();
}

// Rename and/or (de)activate. There is no delete -- history points at a place.
export async function updateLocation(
	id: number,
	input: UpdateLocationInput,
): Promise<Location> {
	const res = await fetch(`/api/locations/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to update place: ${res.status}`);
	}
	return res.json();
}

// Records where an asset is (an optional, dated, append-only fact).
export async function recordAssetLocation(
	assetId: number,
	input: RecordAssetLocationInput,
): Promise<void> {
	const res = await fetch(`/api/assets/${assetId}/locations`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to save location: ${res.status}`);
	}
}

export async function createRma(input: CreateRmaInput): Promise<Rma> {
	const res = await fetch("/api/rmas", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to create RMA: ${res.status}`);
	}
	return res.json();
}

export async function updateRma(
	id: number,
	input: UpdateRmaInput,
): Promise<Rma> {
	const res = await fetch(`/api/rmas/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to update RMA: ${res.status}`);
	}
	return res.json();
}

export async function linkRmaAsset(
	rmaId: number,
	input: LinkRmaAssetInput,
): Promise<RmaAsset> {
	const res = await fetch(`/api/rmas/${rmaId}/assets`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to link asset: ${res.status}`);
	}
	return res.json();
}

export async function updateRmaAssetReason(
	rmaId: number,
	rmaAssetId: number,
	input: UpdateRmaAssetReasonInput,
): Promise<RmaAsset> {
	const res = await fetch(`/api/rmas/${rmaId}/assets/${rmaAssetId}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to update reason: ${res.status}`);
	}
	return res.json();
}

// Same multipart-always convention as servicingFormData -- an optional
// attachment (an AWB, a commercial invoice, a repair report) can ride
// along, so the proxy route and gateway endpoint only ever handle one
// request shape.
function rmaEventFormData(
	input: RecordRmaEventInput,
	attachment?: File,
): FormData {
	const formData = new FormData();
	formData.append("eventType", input.eventType);
	formData.append("eventDate", input.eventDate);
	if (input.facilityId != null) {
		formData.append("facilityId", String(input.facilityId));
	}
	if (input.referenceNumber) {
		formData.append("referenceNumber", input.referenceNumber);
	}
	if (input.notes) formData.append("notes", input.notes);
	if (attachment) formData.append("attachment", attachment);
	return formData;
}

export async function recordRmaEvent(
	rmaId: number,
	input: RecordRmaEventInput,
	attachment?: File,
): Promise<void> {
	const res = await fetch(`/api/rmas/${rmaId}/events`, {
		method: "POST",
		body: rmaEventFormData(input, attachment),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to record event: ${res.status}`);
	}
}

export async function updateRmaEvent(
	rmaId: number,
	eventId: number,
	input: RecordRmaEventInput,
	attachment?: File,
): Promise<void> {
	const res = await fetch(`/api/rmas/${rmaId}/events/${eventId}`, {
		method: "PATCH",
		body: rmaEventFormData(input, attachment),
	});
	if (!res.ok) {
		const data = await res.json().catch(() => null);
		throw new Error(data?.message ?? `Failed to update event: ${res.status}`);
	}
}
