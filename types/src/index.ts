export type AssetStatus =
	| "lab"
	| "in_house_repairs"
	| "factory_service"
	| "transit"
	| "deployed"
	| "on_loan"
	| "missing"
	| "decommissioned";

export interface AssetStatusOption {
	id: number;
	name: AssetStatus;
	description: string;
}

export type UserRole = "viewer" | "editor" | "admin";

export interface AuthUser {
	id: number;
	email: string;
	role: UserRole;
}

export interface LoginInput {
	email: string;
	password: string;
}

export interface LoginResponse {
	token: string;
	user: AuthUser;
}

export interface Glider {
	id: number;
	name: string;
	wmo: string | null;
	platform: string | null;
	// Free-text local model variant (e.g. "G3", "G3 persistor") — carries
	// real distinctions NVS can't express, since some variants share the
	// same B76 term. Combine with `platform` for a short display label.
	platformModel: string | null;
	// NVS-sourced (B76/L06) — full model name and platform category.
	platformModelFull: string | null;
	platformModelUri: string | null;
	platformCategory: string | null;
	platformCategoryDefinition: string | null;
	platformCategoryUri: string | null;
	serialNumber: string | null;
	owner: string | null;
	// Short local code (e.g. "TWR") — `manufacturerL35Name` is the
	// NVS-sourced preferred label, used for display when present.
	manufacturer: string | null;
	manufacturerL35Name: string | null;
	manufacturerL35Definition: string | null;
	// The PLATFORM's manufacturer (platforms.manufacturer_id), distinct
	// from the physical asset's own manufacturer above — conceptually
	// "who makes this model" vs. "who's on record for this unit". Same
	// value in practice today, but a different join.
	platformManufacturerName: string | null;
	platformManufacturerUri: string | null;
	purchaseDate: string | null;
	statusId: number | null;
	status: AssetStatus | null;
	statusEffectiveDate: string | null;
}

export interface CreateGliderInput {
	name: string;
	wmo?: string | null;
	platformId?: number | null;
	serialNumber?: string | null;
}

export interface UpdateGliderInput {
	name?: string;
	wmo?: string | null;
	platformId?: number | null;
	serialNumber?: string | null;
}

export interface SetGliderStatusInput {
	statusId: number;
	notes?: string | null;
}

export interface MissionsSummary {
	totalMissions: number;
	totalDives: number;
	totalDistanceKm: number;
	totalDays: number;
}

export interface MissionsLeaderboard {
	mostDaysInWater: { glider: string; days: number } | null;
	longestTraveller: { glider: string; distanceKm: number } | null;
	mostDives: { glider: string; dives: number } | null;
	longestDeployment: {
		glider: string;
		stdMissionName: string;
		days: number;
	} | null;
	mostProjectDays: { project: string; days: number } | null;
	mostSiteDays: { site: string; days: number } | null;
}

export interface Asset {
	id: number;
	name: string | null;
	serialNumber: string | null;
	assetType: string;
	assetTypeGroup: string;
	assetModel: string | null;
	// NVS-sourced (B76/L06) — only populated for gliders right now, same
	// caveat as assetModel/name.
	platformModelFull: string | null;
	platformCategory: string | null;
	purchaseDate: string | null;
	purchaseValueUsd: number | null;
	statusId: number | null;
	status: AssetStatus | null;
	statusEffectiveDate: string | null;
}

export type DatasetProcessingStage = "raw" | "L0" | "L1" | "L2";

export interface DatasetProcessingStageQc {
	removingErroneousData: boolean;
	offsetCorrection: boolean;
	despikingFiltering: boolean;
	// package/versionUrl are display strings (joined at read time); the
	// *Id fields are the raw FKs, needed to pre-select the right option
	// when editing rather than re-resolving name -> id.
	package: string | null;
	packageId: number | null;
	versionUrl: string | null;
	versionId: number | null;
	occurredAt: string | null;
	who: string | null;
	whoId: number | null;
}

export interface DatasetProcessingStageDetail {
	stage: DatasetProcessingStage;
	// "raw" has no package/version/QC/OG1/download concept at all — the
	// dashboard renders those as "n/a" rather than "not done yet" for it.
	applicable: boolean;
	status: boolean;
	who: string | null;
	whoId: number | null;
	occurredAt: string | null;
	package: string | null;
	packageId: number | null;
	versionUrl: string | null;
	versionId: number | null;
	qc: DatasetProcessingStageQc | null;
	isOg1: boolean | null;
	// Derived from whether a matching `documents` row exists (document_type
	// "<stage>_output"/"<stage>_og1") — not a real file attachment yet, so
	// these are read-only for now (no file storage decision made). See
	// RecordDatasetStageInput: there is deliberately no way to set these.
	hasInternalDownload: boolean;
	hasInternalDownloadOg1: boolean;
}

export interface DatasetHistoryEntry {
	occurredAt: string;
	description: string;
}

export interface DatasetProcessingDetail {
	missionId: number;
	missionNumber: number | null;
	missionName: string;
	status: string | null;
	glider: string | null;
	site: string | null;
	launchDate: string | null;
	recoveryDate: string | null;
	doi: string | null;
	externalDataArchiveUrl: string | null;
	oceanOpsBoardUrl: string | null;
	coriolisUrl: string | null;
	stages: DatasetProcessingStageDetail[];
	history: DatasetHistoryEntry[];
}

export interface DatasetProcessingStatus {
	missionId: number;
	missionName: string;
	l0Status: boolean;
	l1Status: boolean;
	l1Og1: boolean;
	l2Status: boolean;
	l2Og1: boolean;
}

// A person who can be picked for "who"/"QC who" -- an OGDB app user with a
// linked contact (excludes service/test accounts). contactId is what
// actually gets submitted: who_id/qc_who_id FK to contacts, not users. id
// is the users.id, kept alongside so the current session's user (from
// AuthUser.id) can be matched to their contactId for autofill.
export interface OgdbUser {
	id: number;
	contactId: number;
	name: string;
}

export interface ProcessingPackageVersion {
	id: number;
	versionLabel: string;
	versionUrl: string | null;
}

// The controlled package/version catalog backing every package/version
// field in the dataset editor (main processing and QC both draw from the
// same list). Versions come nested since the picker always needs a
// package's full version list at once -- no separate lazy-load endpoint
// for a list this small.
export interface ProcessingPackage {
	id: number;
	name: string;
	versions: ProcessingPackageVersion[];
}

export interface NewProcessingPackageInput {
	name: string;
}

export interface NewProcessingPackageVersionInput {
	versionLabel: string;
	versionUrl?: string | null;
}

// One new row in dataset_processing_stages -- the table is append-only
// (a reprocessing run adds a row, never overwrites), so "editing" a stage
// means submitting a brand new record, not patching the current one.
export interface RecordDatasetStageInput {
	stage: DatasetProcessingStage;
	status: boolean;
	whoId?: number | null;
	occurredAt: string;
	packageId?: number | null;
	versionId?: number | null;
	// null clears any previously-recorded QC for this run (not applicable);
	// omit only when the stage doesn't support QC at all (raw/L0).
	qc?: {
		removingErroneousData: boolean;
		offsetCorrection: boolean;
		despikingFiltering: boolean;
		qcWhoId?: number | null;
		qcOccurredAt?: string | null;
		qcPackageId?: number | null;
		qcVersionId?: number | null;
	} | null;
	isOg1?: boolean | null;
}

// Batched so recording new runs for several stages at once is one
// transaction, same reasoning as the glider build editor's BuildChange[].
export interface ApplyDatasetStagesInput {
	stages: RecordDatasetStageInput[];
}

// dataset_processing is current-state (unique per mission), not an event
// log -- a plain update/upsert, unlike the stages above. doi lives on
// missions, not dataset_processing, but is edited from the same form.
export interface UpdateExternalReferencesInput {
	doi?: string | null;
	externalDataArchiveUrl?: string | null;
	oceanOpsBoardUrl?: string | null;
	coriolisUrl?: string | null;
}

export interface Mission {
	id: number;
	// norglider_missions itself only exposes the glider's name (`glider`
	// below) -- this is pulled in separately via missions.glider_asset_id
	// so the mission page can locate which glider's build to edit.
	gliderAssetId: number | null;
	missionNumber: number | null;
	missionName: string | null;
	stdMissionName: string | null;
	status: string | null;
	project: string | null;
	glider: string | null;
	platform: string | null;
	site: string | null;
	pi: string | null;
	tech: string | null;
	operatingAgency: string | null;
	fundingAgency: string | null;
	launchCruiseId: number | null;
	recoveryCruiseId: number | null;
	volume: number | null;
	weightInAir: number | null;
	density: number | null;
	iridiumMinutes: number | null;
	launchDate: string | null;
	launchLatitude: number | null;
	launchLongitude: number | null;
	endDateScience: string | null;
	recoveryDate: string | null;
	recoveryLatitude: number | null;
	recoveryLongitude: number | null;
	dives: number | null;
	distanceKm: number | null;
	numberOfDays: number | null;
	// UNC/network path to this mission's data folder, shown in the "Key
	// files" section. Free text, not validated as a real path -- rendered
	// as a best-effort clickable link since file://\\server\share links
	// aren't reliably clickable across browsers.
	missionFolderPath: string | null;
}

export interface UpdateMissionFolderPathInput {
	missionFolderPath: string | null;
}

export interface GliderBuildComponent {
	assignmentId: number;
	assetId: number;
	parentAssetId: number;
	assetType: string;
	assetTypeGroup: string;
	serialNumber: string | null;
	position: string | null;
	installDate: string | null;
	depth: number;
	// Only populated for science sensors (NVS L22 model), batteries
	// (battery_models.model), and hulls (hull_models.teledyne_part_number)
	// — no other asset type has a model concept in the schema yet.
	model: string | null;
	// NVS L22 term URI — only populated alongside `model` for science
	// sensors (batteries/hulls have no NVS-backed model, so always null).
	modelUri: string | null;
}

export interface SensorCalRecord {
	date: string | null;
	// Column names/values vary per sensor type (CT/DO/ECO each have a
	// completely different coefficient set) — kept generic rather than
	// typing out every column, same reasoning as the DB's own per-type
	// cal tables.
	coefficients: Record<string, number | string | null>;
}

// A P01 term an asset_sensor_parameters row points at -- "readable
// format for now" per Fiona: just the NVS preferred label, not the full
// definition text.
export interface MeasuredParameter {
	label: string;
	uri: string;
}

// One science sensor row for the mission page's Science Payload table.
// Distinct from GliderBuildComponent/GliderComponentDetail (which are
// always "as of today") -- everything here is resolved as of the
// mission's own launch date, so an old mission shows the calibration
// that was actually in effect on it, not whatever the sensor is
// calibrated to now.
export interface ScienceSensorRecord {
	assetId: number;
	assetType: string;
	serialNumber: string | null;
	model: string | null;
	modelUri: string | null;
	measuredParameters: MeasuredParameter[];
	// null when no calibration record exists with a date on or before
	// asOfDate (not the same as "sensor has never been calibrated" --
	// just none on record that early).
	calibration: SensorCalRecord | null;
	asOfDate: string;
}

// New calibration event for an asset with a cal table (ct_sensor,
// do_sensor, eco_sensor, slocum_forward_section). Always an INSERT, never
// an update -- these tables are append-only, same "current = latest by
// date" pattern as everywhere else. `coefficients` keys must be real DB
// column names for that asset type's cal table (see gateway's
// CAL_COLUMNS) -- the dashboard's paste-parser is responsible for
// mapping a pasted format's variable names (e.g. "t_g") to the real
// column name ("a0_g_apl") before this ever gets built.
export interface RecordSensorCalibrationInput {
	calDate: string;
	coefficients: Record<string, number | string | null>;
}

export interface GliderStatusHistoryItem {
	id: number;
	assetId: number;
	assetType: string;
	serialNumber: string | null;
	status: AssetStatus;
	effectiveDate: string;
	notes: string | null;
	changedByEmail: string | null;
}

export interface GliderEditHistoryItem {
	tableName: string;
	rowId: number;
	operation: string;
	changedAt: string;
	changedByEmail: string | null;
}

// Full detail-table row and full cal history for one component, for the
// Current Build table's row expansion. `detail`/`calibrations` are null
// when the asset type has no detail table / no cal table at all (not
// the same as "has one but it's empty") — lets the UI omit a section
// entirely rather than showing a false "no data yet".
export interface GliderComponentDetail {
	assetId: number;
	detail: Record<string, string | number | boolean | null> | null;
	calibrations: SensorCalRecord[] | null;
}

// A filtered, curated view of norglider_missions for one glider — the
// Deployment History table on the glider detail page, not the full
// missions catalogue's column set.
export interface GliderDeployment {
	id: number;
	missionNumber: number | null;
	stdMissionName: string | null;
	status: string | null;
	site: string | null;
	launchDate: string | null;
	recoveryDate: string | null;
	dives: number | null;
	distanceKm: number | null;
}

export interface AssetSearchResult {
	id: number;
	serialNumber: string | null;
	model: string | null;
}

// A part never seen in OGDB before -- the minimal "+ New asset" case
// (serial + flat model text only). Not a substitute for the full
// worksheet-based creation flow (arbitrary detail fields, battery/hull
// model lookups) -- just covers the common case of a genuinely new
// structural part turning up mid-edit.
export interface NewAssetInput {
	assetType: string;
	serialNumber: string;
	model?: string | null;
}

// The three actions the build editor can take on a component. "replace"
// and "remove" both close an existing open assignment; "replace" opens a
// new one under the same parent/position, "remove" doesn't. "add" opens
// one with no assignment to close. All changes in one request are applied
// as a single transaction (see ApplyBuildChangesInput). "replace"/"add"
// take exactly one of childAssetId (existing asset) or newAsset (create
// it first, same transaction).
export interface BuildChangeReplace {
	action: "replace";
	assignmentId: number;
	childAssetId?: number;
	newAsset?: NewAssetInput;
}

export interface BuildChangeRemove {
	action: "remove";
	assignmentId: number;
	// Setting a status alongside the removal is optional -- most removals
	// happen because the part is going somewhere specific (calibration,
	// factory repair), but not always known at entry time.
	newStatusId?: number | null;
	statusNotes?: string | null;
}

export interface BuildChangeAdd {
	action: "add";
	parentAssetId: number;
	childAssetId?: number;
	newAsset?: NewAssetInput;
	position?: string | null;
}

export type BuildChange =
	| BuildChangeReplace
	| BuildChangeRemove
	| BuildChangeAdd;

export interface ApplyBuildChangesInput {
	effectiveDate: string;
	// Set when opened from a mission page; null when opened from the
	// glider page for a servicing-log-driven change.
	missionId?: number | null;
	notes?: string | null;
	changes: BuildChange[];
}

export interface GliderBuild {
	components: GliderBuildComponent[];
	componentDetails: GliderComponentDetail[];
	deployments: GliderDeployment[];
	// Same shape as the fleet-wide MissionsSummary, scoped to this glider's
	// own missions — reused rather than a new type since the fields match
	// exactly.
	missionsSummary: MissionsSummary;
	statusHistory: GliderStatusHistoryItem[];
	editHistory: GliderEditHistoryItem[];
}

export interface Cruise {
	id: number;
	cruiseName: string;
	cruiseNumber: string | null;
	vessel: string | null;
	vesselUrl: string | null;
	institute: string | null;
	// Plain text in the DB, not linked to contacts like missions' PI/tech
	// are — surfaced as-is. Deliberately not called "pi": a cruise leader
	// isn't the same role as a mission's PI.
	cruiseLeader: string | null;
	area: string | null;
	startDate: string;
	endDate: string;
	startPort: string | null;
	endPort: string | null;
}
