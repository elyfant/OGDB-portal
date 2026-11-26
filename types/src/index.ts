export type AssetStatus =
	| "lab"
	| "in_house_repairs"
	| "factory_service"
	| "pre_mission_service"
	| "transit"
	| "deployed"
	| "on_loan"
	| "field_test"
	| "missing"
	| "destroyed"
	// Derived glider states, from the workshop build / cleared logsheet /
	// "nothing else applies" -- see docs/design/glider-state-and-location.md.
	// `idle` replaces `lab` as a glider's default: Lab is a LOCATION now.
	// (`lab` stays for non-glider assets, which set status by hand.)
	| "workshop"
	| "ready_to_deploy"
	| "idle"
	// Non-glider assets still set this manually via asset_status_history.
	// For gliders it is a derived value and never "decommissioned" -- fleet
	// retirement moved to Glider.decommissionedDate (see below).
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
	purchaseValue: number | null;
	purchaseCurrency: string;
	// `status` is derived from the glider's timeline (open mission / open
	// service event / a `destroyed` marker), not a hand-set value -- see
	// docs/design/derived-glider-status.md. `statusId` is that name
	// resolved back to an asset_status_options id, kept only for callers
	// that still key off it. `statusSource` says which fact drove it.
	statusId: number | null;
	status: AssetStatus | null;
	statusSource: "mission" | "service_event" | "default" | null;
	// When the current status started -- the driving event's start date
	// (`statusEffectiveDate` is the same value, kept for now under its old
	// name; prefer `statusSince`).
	statusSince: string | null;
	statusEffectiveDate: string | null;
	// Fleet lifecycle, independent of `status`. NULL = active fleet. A
	// retired glider still has a real operational status.
	decommissionedDate: string | null;
	decommissionReason: string | null;
	// Where it is -- a separate axis from `status`, from the
	// current_asset_location view. Optional by design: a recovered glider
	// whose location nobody has recorded is "not_recorded", not an error.
	//   at_sea       deployed (location is "At sea"; no place can be set)
	//   unknown      missing
	//   none         destroyed (location is null)
	//   recorded     the latest asset_location_history row
	//   not_recorded nothing recorded since the last retrieval
	location: string | null;
	locationId: number | null;
	locationSince: string | null;
	locationSource: GliderLocationSource | null;
	// Scheduled is a flag about the mission plan, not a state: a scheduled
	// glider can still be in the workshop. Null = no mission assigned.
	scheduledMissionId: number | null;
	scheduledDate: string | null;
	// Raw FK ids alongside the resolved display strings above (platform,
	// owner) — needed to pre-select the right dropdown option when
	// editing, the same reason Mission exposes both observatoryId and observatory.
	platformId: number | null;
	agencyId: number | null;
}

export type GliderLocationSource =
	| "at_sea"
	| "unknown"
	| "none"
	| "recorded"
	| "not_recorded";

// A place from the shared `locations` list. Flat on purpose (no shelves).
// `assetCount` = assets currently reading this place as their valid,
// recorded location. Inactive places are hidden from pick lists but stay on
// the history that points at them.
export interface Location {
	id: number;
	name: string;
	active: boolean;
	assetCount: number;
}

export interface CreateLocationInput {
	name: string;
}

export interface UpdateLocationInput {
	name?: string;
	active?: boolean;
}

export interface RecordAssetLocationInput {
	locationId: number;
	// YYYY-MM-DD; defaults to today, can't be in the future.
	effectiveDate?: string | null;
	note?: string | null;
}

export interface CreateGliderInput {
	name: string;
	wmo?: string | null;
	platformId?: number | null;
	serialNumber?: string | null;
	agencyId?: number | null;
	purchaseDate?: string | null;
	purchaseValue?: number | null;
}

export interface UpdateGliderInput {
	name?: string;
	wmo?: string | null;
	platformId?: number | null;
	serialNumber?: string | null;
	agencyId?: number | null;
	purchaseDate?: string | null;
	purchaseValue?: number | null;
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
	mostDaysInWater: {
		glider: string;
		gliderAssetId: number | null;
		days: number;
	} | null;
	longestTraveller: {
		glider: string;
		gliderAssetId: number | null;
		distanceKm: number;
	} | null;
	mostDives: {
		glider: string;
		gliderAssetId: number | null;
		dives: number;
	} | null;
	longestDeployment: {
		glider: string;
		missionId: number;
		stdMissionName: string;
		days: number;
	} | null;
	mostProjectDays: { project: string; days: number } | null;
	mostObservatoryDays: { observatory: string; days: number } | null;
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
	// asset_sensor_details.l22_model_id -- science sensors only (the raw
	// FK, not a resolved label, so the asset-edit form can pre-select the
	// current model in its L22 dropdown). Null for every other asset type.
	l22ModelId: number | null;
	purchaseDate: string | null;
	purchaseValue: number | null;
	purchaseCurrency: string;
	statusId: number | null;
	status: AssetStatus | null;
	statusEffectiveDate: string | null;
	// Fleet lifecycle, independent of `status` -- same column as
	// Glider.decommissionedDate above, just also surfaced for a bare
	// asset now that a glider's retirement can cascade onto its
	// components (see DecommissionInput.childAssetIds).
	decommissionedDate: string | null;
	decommissionReason: string | null;
}

// Every column of an asset's per-type detail table (asset_<type>_details),
// generically -- the keys are the database column names. `fields` is null
// when the type has no detail table or its table is lookup-backed (see
// NO_GENERIC_DETAILS on the gateway), which means "show no section", not
// "empty". For a Slocum aft section `glider` replaces glider_asset_id with
// the glider's name.
export interface AssetDetails {
	assetType: string;
	fields: Record<string, string | number | boolean | null> | null;
}

// Wear counters from the asset_wear_counters view -- only assets whose type
// (and, for gliders, platform) is flagged tracks_wear have one. Days since
// servicing restart on a factory repair or calibration; both are null /
// lifetime when `neverServiced`.
export interface AssetWear {
	assetId: number;
	assetType: string;
	serialNumber: string | null;
	// Glider name for a glider asset, otherwise null.
	gliderName: string | null;
	lastServicingDate: string | null;
	lastServicingEventType: string | null;
	daysSinceServicing: number | null;
	// Mission-days since last servicing (lifetime total if never serviced).
	daysInWaterSinceServicing: number;
	neverServiced: boolean;
	decommissionedDate: string | null;
}

// One asset_status_history row for a single asset (the per-asset
// counterpart of GliderStatusHistoryItem, which spans a glider's build).
export interface AssetStatusHistoryEntry {
	id: number;
	status: string;
	effectiveDate: string;
	notes: string | null;
	changedByEmail: string | null;
}

// One changed field of an UPDATE in the audit log. Values are the raw
// stored ones, so a foreign key shows as its id (e.g. status_id: 3 -> 4).
export interface AssetChangeField {
	field: string;
	oldValue: string | number | boolean | null;
	newValue: string | number | boolean | null;
}

// One audit_log row touching an asset: its own row, its per-type detail
// row, or a child record (status history, service events, calibrations,
// assignments, documents...). `changes` is filled for UPDATEs only.
export interface AssetChange {
	id: number;
	tableName: string;
	rowId: number;
	operation: "INSERT" | "UPDATE" | "DELETE";
	changedAt: string;
	changedByEmail: string | null;
	changes: AssetChangeField[];
}

// The Batteries catalogue row -- assets of type "battery" with their
// battery-specific detail fields joined in (the generic "All assets"
// table has no source for model/manufacture date/weight). Weight is the
// latest asset_battery_measurements reading.
export interface Battery {
	id: number;
	serialNumber: string | null;
	agency: string | null;
	batteryModel: string | null;
	dateOfManufacture: string | null;
	weight: number | null;
	purchaseDate: string | null;
	purchaseValue: number | null;
	purchaseCurrency: string;
	statusId: number | null;
	status: AssetStatus | null;
	statusEffectiveDate: string | null;
	// Fleet lifecycle, as for any asset: set when the battery is decommissioned
	// or destroyed (directly, or along with the glider it was in).
	decommissionedDate: string | null;
}

// One row of the append-only asset_battery_measurements history -- a
// battery is re-measured over its life (capacity degrades), so this is a
// dated series, not a single current value. Any field can be null on a
// given row (e.g. a capacity-only test leaves voltage/weight unset).
export interface BatteryMeasurement {
	id: number;
	measuredDate: string;
	voltage: number | null;
	// Grams -- legacy battery_inventory.weight unit (a Slocum pack is
	// ~10 000).
	weight: number | null;
	// Fraction 0–1 of the model's nominal capacity still available.
	remainingCapacity: number | null;
	ageDerating: number | null;
	notes: string | null;
}

// Read-only battery detail for the asset page's "Battery details"
// accordion: the per-instance spec (asset_battery_details) plus the
// measurement history, newest first.
// The model-level spec (battery_models) for a battery's model -- shared by
// every pack of that model, unlike the per-pack fields on BatteryDetail.
export interface BatteryModelSpec {
	model: string;
	manufacturerPartNumber: string | null;
	// Ah
	capacity: number | null;
	// V
	nominalVoltage: number | null;
	// Wh
	wattHours: number | null;
	chemistry: string | null;
	unClassification: string | null;
	// Resolved platform label (NVS name, or the platform's own name/model).
	platform: string | null;
	// The model's current safety data sheet -- the latest document of type
	// "safety_data_sheet" owned by this model (older uploads stay on record).
	// Served by GET /api/documents/{id}/file. Null if none uploaded yet.
	sdsDocumentId: number | null;
	sdsFileName: string | null;
}

export interface BatteryDetail {
	spec: BatteryModelSpec | null;
	// The raw FKs (assets.agency_id, asset_battery_details.battery_model_id)
	// so the edit dialog can pre-select the current values.
	agencyId: number | null;
	agency: string | null;
	batteryModelId: number | null;
	batteryModel: string | null;
	dateOfManufacture: string | null;
	measurements: BatteryMeasurement[];
}

// A dated weight and/or voltage reading for a battery (one row of
// asset_battery_measurements). At least one of weight/voltage is required;
// measuredDate defaults to today server-side.
export interface RecordBatteryMeasurementInput {
	measuredDate?: string;
	// g
	weight?: number | null;
	// V
	voltage?: number | null;
}

// Generic fields only — every asset type has these, but only gliders
// (created via CreateGliderInput instead) have their own detail-table
// fields modeled yet. assetTypeId must not resolve to "glider".
export interface CreateAssetInput {
	assetTypeId: number;
	serialNumber?: string | null;
	notes?: string | null;
	purchaseDate?: string | null;
	purchaseValue?: number | null;
	// ISO 4217 code; omit to leave unchanged (new assets default to USD).
	purchaseCurrency?: string;
	agencyId?: number | null;
	// Science sensors only -- ignored server-side for any other asset type.
	l22ModelId?: number | null;
	// Equipment only -- required on create for the `equipment` type.
	equipmentName?: string | null;
	equipmentModel?: string | null;
	// Batteries only -- ignored server-side for any other asset type.
	// batteryModelId + dateOfManufacture land on asset_battery_details;
	// weight opens the asset_battery_measurements history.
	batteryModelId?: number | null;
	dateOfManufacture?: string | null;
	weight?: number | null;
}

// assetTypeId deliberately absent -- changing what type an asset is
// after creation isn't supported through this form (see UpdateAssetDto
// on the gateway side). An omitted field keeps its current value rather
// than clearing it (COALESCE-based update, same as UpdateGliderInput).
export interface UpdateAssetInput {
	serialNumber?: string | null;
	notes?: string | null;
	purchaseDate?: string | null;
	purchaseValue?: number | null;
	// ISO 4217 code; omit to leave unchanged (new assets default to USD).
	purchaseCurrency?: string;
	// Science sensors only. Omit to leave unchanged; null clears it.
	l22ModelId?: number | null;
	// Equipment only. Omit to leave unchanged.
	equipmentName?: string | null;
	equipmentModel?: string | null;
	// Omit to leave unchanged; null clears it.
	agencyId?: number | null;
	// Batteries only (asset_battery_details). Omit to leave unchanged; null
	// clears it.
	batteryModelId?: number | null;
	dateOfManufacture?: string | null;
}

// "DM"/"PUB" replaced "L1"/"L2" (see xxxx_dataset_processing_dm_published.py
// in OGDB) -- the stage taxonomy tracks processing maturity (delayed mode
// vs. published) rather than output format, matching the NorGliders QC
// processing pipeline (both platforms produce their timeseries and
// gridded products together at each maturity step; format-specific
// links live on the external-references URLs instead).
// Renamed 2026-10-07 (OGDB xxxx_processing_stages_qc_levels): stages are
// named for their QC level -- DM -> AUTO_QC, PUB -> MANUAL_QC -- and
// BASESTATION is new (the Seaglider basestation's own automatic processing
// during the mission). "Published" is tracked separately (erddap_pushes).
export type DatasetProcessingStage =
	| "raw"
	| "L0"
	| "BASESTATION"
	| "AUTO_QC"
	| "MANUAL_QC";

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
	versionLabel: string | null;
	versionId: number | null;
	// null = QC hasn't been touched for this run (raw/L0, or a DM/PUB run
	// nobody's QC'd yet). No separate QC-specific package/version/who/date
	// -- QC is treated as part of the same run described by the fields
	// above; detail (what/by whom) goes in processingNotes instead.
	qcDone: boolean | null;
	isOg1: boolean | null;
	// Free text, up to 5000 chars (enforced app-side, not in the DB) --
	// e.g. a pasted-in reprocessing readme: bounds/offsets used, skipped
	// dives, known caveats. See dataset_processing_stages.processing_notes.
	processingNotes: string | null;
	// Derived from whether a matching `documents` row exists (document_type
	// "<stage>_output"/"<stage>_og1") — not a real file attachment yet, so
	// these are read-only for now (no file storage decision made). See
	// RecordDatasetStageInput: there is deliberately no way to set these.
	hasInternalDownload: boolean;
	hasInternalDownloadOg1: boolean;
	// The NetCDF files this stage's latest run produced (relative to the
	// shared projects folder) -- set by the ingest scripts, carried over to
	// later runs recorded in the portal. Only BASESTATION/AUTO_QC/MANUAL_QC.
	l1File: string | null;
	l2File: string | null;
}

export interface DatasetHistoryEntry {
	occurredAt: string;
	description: string;
	// Full snapshot captured by this run (dataset_processing_stages is
	// append-only, so every row already carries its own complete values,
	// not a diff) -- shown on demand (e.g. an expandable row) rather than
	// in the one-line description, since processingNotes alone can run to
	// 5000 chars.
	versionLabel: string | null;
	isOg1: boolean | null;
	qcDone: boolean | null;
	processingNotes: string | null;
}

export interface DatasetProcessingDetail {
	missionId: number;
	missionNumber: number | null;
	missionName: string;
	status: string | null;
	glider: string | null;
	observatory: string | null;
	deploymentDate: string | null;
	retrievalDate: string | null;
	doi: string | null;
	oceanOpsBoardUrl: string | null;
	// NorGliders' own published ERDDAP endpoints -- distinct from
	// oceanOpsBoardUrl/coriolisUrl, which are the real-time feeds. The URL
	// is a stable address; *Status tracks what's currently live there --
	// "none" (nothing confirmed pushed yet), "AUTO_QC", or "MANUAL_QC"
	// (which supersedes AUTO_QC at the same URL). Backed by the
	// append-only erddap_pushes table, not dataset_processing directly.
	erddapL1Url: string | null;
	erddapL1Status: ErddapPushStatus;
	// The internal file currently live at that URL (relative to the shared
	// projects folder) -- from the processing run the push is linked to.
	erddapL1File: string | null;
	erddapL2Url: string | null;
	erddapL2Status: ErddapPushStatus;
	erddapL2File: string | null;
	coriolisUrl: string | null;
	// Best L1/L2 across all runs (mission_best_files) -- see Mission.
	bestL1File: string | null;
	bestL1Stage: DatasetProcessingStage | null;
	bestL2File: string | null;
	bestL2Stage: DatasetProcessingStage | null;
	stages: DatasetProcessingStageDetail[];
	history: DatasetHistoryEntry[];
}

export type ErddapPushStatus = "none" | "BASESTATION" | "AUTO_QC" | "MANUAL_QC";
export type ErddapLevel = "L1" | "L2";

// One row in erddap_pushes -- confirming a status always inserts a new
// row (append-only, same reasoning as RecordDatasetStageInput), so
// there's a record of who confirmed what and when, not just the latest
// value.
export interface ConfirmErddapPushInput {
	level: ErddapLevel;
	status: ErddapPushStatus;
}

export interface DatasetProcessingStatus {
	missionId: number;
	missionName: string;
	doi: string | null;
	rawStatus: boolean;
	autoQcStatus: boolean;
	manualQcStatus: boolean;
	// Folds dmOg1/pubOg1 into one flag -- whichever stage reached OG1
	// first still counts, since the catalogue is an at-a-glance view (the
	// dataset detail page still breaks OG1 out per stage).
	og1: boolean;
	// e.g. "L1 DM · L2 PUB", or "" if nothing's been pushed for either
	// level -- named explicitly per level since L1/L2 can be at different
	// maturities (see DatasetsService.formatErddapColumn).
	erddap: string;
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
	// null clears any previously-recorded QC for this run; omit only when
	// the stage doesn't support QC at all (raw/L0).
	qcDone?: boolean | null;
	isOg1?: boolean | null;
	// Max 5000 chars, enforced by the gateway (see DatasetsService.
	// insertStageRecord), not the DB.
	processingNotes?: string | null;
}

// Batched so recording new runs for several stages at once is one
// transaction, same reasoning as the glider build editor's BuildChange[].
export interface ApplyDatasetStagesInput {
	stages: RecordDatasetStageInput[];
}

// L1 (timeseries)/L2 (gridded) here is the output FORMAT, distinct from
// DatasetProcessingStage's DM/PUB (maturity) -- a single DM run can
// produce both an L1 and an L2 file, disambiguated inside netcdfMetadata
// rather than by a separate document_type per level (see
// xxxx_documents_netcdf_metadata.py and DatasetsService.registerDocument
// for the full reasoning).
export type NetcdfLevel = "L1" | "L2";

// Raw structural facts read off the file itself by the ingest pipeline
// (ogdp.erddap.inspect_netcdf) -- a read-optimized mirror of file
// content, not a duplicate of the process-tracking fields already on
// DatasetProcessingStage (package/QC/OG1/who/when).
export interface NetcdfMetadata {
	level: NetcdfLevel;
	convention: string;
	dimensions: Record<string, number>;
	globalAttrs: Record<string, unknown>;
	variables: Record<string, { dims: string[]; dtype: string }>;
}

// One new row in `documents` (document_type = "<stage>_output", e.g.
// "dm_output"/"pub_output" -- matches DatasetsService.findDetail's
// existing hasInternalDownload lookup convention, so this plugs into
// the dashboard's current display with no UI changes needed).
export interface RegisterDatasetDocumentInput {
	stage: DatasetProcessingStage;
	fileReference: string;
	fileHash: string;
	fileSizeBytes: number;
	netcdfMetadata: NetcdfMetadata;
}

// dataset_processing is current-state (unique per mission), not an event
// log -- a plain update/upsert, unlike the stages above. doi lives on
// missions, not dataset_processing, but is edited from the same form.
export interface UpdateExternalReferencesInput {
	doi?: string | null;
	oceanOpsBoardUrl?: string | null;
	erddapL1Url?: string | null;
	erddapL2Url?: string | null;
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
	statusId: number | null;
	project: string | null;
	projectId: number | null;
	glider: string | null;
	platform: string | null;
	observatory: string | null;
	observatoryId: number | null;
	pi: string | null;
	principalInvestigatorId: number | null;
	operationsManager: string | null;
	operationsManagerId: number | null;
	piFullName: string | null;
	piWebpage: string | null;
	operationsManagerFullName: string | null;
	operationsManagerWebpage: string | null;
	projectUrl: string | null;
	operatingAgency: string | null;
	operatingAgencyId: number | null;
	fundingAgency: string | null;
	fundingAgencyId: number | null;
	// OceanOPS Passport ID (a WIGOS Station Identifier, e.g.
	// 0-22000-3-6801623). Null until the mission is registered.
	wigosId: string | null;
	// Why the mission ended (OceanOPS ending-cause vocabulary, ending_causes
	// table). Null while the mission is running or not yet reviewed.
	endingCauseId: number | null;
	endingCause: string | null;
	deploymentCruiseId: number | null;
	retrievalCruiseId: number | null;
	volume: number | null;
	weightInAir: number | null;
	density: number | null;
	iridiumMinutes: number | null;
	deploymentDate: string | null;
	deploymentLatitude: number | null;
	deploymentLongitude: number | null;
	endDateScience: string | null;
	retrievalDate: string | null;
	retrievalLatitude: number | null;
	retrievalLongitude: number | null;
	dives: number | null;
	distanceKm: number | null;
	numberOfDays: number | null;
	// The mission's best internal L1/L2 NetCDF files and the processing
	// stage each came from -- computed by OGDB's mission_best_files view
	// (highest QC level among completed runs, then the latest run), never
	// stored. Paths are relative to the shared projects folder, e.g.
	// naco/data/delayed/095-.../basestation/x.nc. Per-run files are on
	// DatasetProcessingStageDetail.
	bestL1File: string | null;
	bestL1Stage: DatasetProcessingStage | null;
	bestL2File: string | null;
	bestL2Stage: DatasetProcessingStage | null;
}

// One file attached to a mission (documents.mission_id) -- the "Key
// files" section on the mission detail page. Uploaded through the portal
// and stored on the same DOCUMENTS_DIR volume as calibration
// certificates.
export interface MissionFile {
	id: number;
	// Human-readable name: the sanitized original filename, with the UUID
	// prefix saveUploadedFile adds stripped back off.
	name: string;
	documentType: string;
	notes: string | null;
	createdAt: string;
	// false for legacy rows whose file_reference points at the old
	// network share (never copied onto this VM) -- the open link is
	// disabled for those.
	available: boolean;
}

// Result of one "save" from the Add key mission file modal: the modal
// batches new uploads and removals into a single request, and the
// success banner lists both by name.
export interface MissionFilesSaveResult {
	saved: string[];
	deleted: string[];
}

export interface MissionTrackPoint {
	latitude: number;
	longitude: number;
	utc: string;
	temperature: number | null;
	salinity: number | null;
}

// One mission as the fleet-wide Map page needs it: just enough to
// label, filter and link it, plus its whole track as bare [lat, lon]
// pairs. Pairs rather than MissionTrackPoint objects because this
// endpoint returns every mission's track at once -- dropping the
// repeated keys and the per-fix utc/temp/sal the map never shows keeps
// the payload several times smaller. `track` is [] for a mission with
// no rows in `tracks` yet, so the map can still list it.
export interface MissionMapEntry {
	id: number;
	missionNumber: number | null;
	missionName: string | null;
	stdMissionName: string | null;
	status: string | null;
	glider: string | null;
	platform: string | null;
	project: string | null;
	observatory: string | null;
	deploymentDate: string | null;
	retrievalDate: string | null;
	endDateScience: string | null;
	track: [number, number][];
}

// A simple id/name reference option -- projects, observatories, agencies,
// contacts. Shared shape since every lookup dropdown in the Add Mission
// dialog renders identically regardless of which table backs it.
export interface LookupOption {
	id: number;
	name: string;
}

// Everything the Add Mission dialog can submit. missionName is
// deliberately absent -- it's server-computed from
// glider/project/observatory/deploymentDate, never client-submitted, so it can't
// drift from the naming convention. statusId/gliderAssetId/projectId/
// observatoryId/deploymentDate are the only fields the dialog treats as required;
// everything else is nullable/omittable.
export interface CreateMissionInput {
	// Permanent facility-wide number. Leave out for a workshop/scheduled
	// mission; it is assigned when the mission becomes active.
	missionNumber?: number | null;
	gliderAssetId: number;
	statusId: number;
	// A workshop mission needs only the glider. Scheduled needs project and
	// observatory; an active/recovered mission also needs a deployment date. The
	// gateway enforces this per status.
	projectId?: number | null;
	observatoryId?: number | null;
	deploymentDate?: string | null;
	principalInvestigatorId?: number | null;
	operationsManagerId?: number | null;
	operatingAgencyId?: number | null;
	fundingAgencyId?: number | null;
	deploymentLatitude?: number | null;
	deploymentLongitude?: number | null;
	deploymentCruiseId?: number | null;
	endDateScience?: string | null;
	retrievalDate?: string | null;
	retrievalLatitude?: number | null;
	retrievalLongitude?: number | null;
	retrievalCruiseId?: number | null;
	volume?: number | null;
	weightInAir?: number | null;
	density?: number | null;
	dives?: number | null;
	distanceKm?: number | null;
	iridiumMinutes?: number | null;
	wigosId?: string | null;
}

// Editing adds one field creating doesn't have: a new mission hasn't ended.
export interface UpdateMissionInput extends CreateMissionInput {
	endingCauseId?: number | null;
}

export interface CreatedMission {
	id: number;
	missionNumber: number | null;
	missionName: string | null;
}

export interface GliderBuildComponent {
	// mission_build_items.id -- the row to replace/remove in this mission's
	// build. The Slocum aft section is one too (stored so a mission's build
	// is complete on its own), but it is the glider's identity: the editor
	// never offers to replace or remove it.
	itemId: number;
	assetId: number;
	// The glider, or the part this one is mounted in (e.g. a payload bay).
	parentAssetId: number;
	assetType: string;
	assetTypeGroup: string;
	serialNumber: string | null;
	position: string | null;
	// What this glider's platform calls that position, where it translates it
	// -- batteries: a Seaglider's fore/aft slots are "Secondary"/"Primary", an
	// SGX's fore/middle/aft are "Secondary"/"Primary"/"Aft", a Slocum's are
	// "Fore"/"Energy"/"Aft". Null when there's nothing to translate (show
	// `position` as is).
	positionLabel: string | null;
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
	// Only set for asset types whose cal table has a service_event_id
	// link to hang a certificate off (ct_sensor, do_sensor, eco_sensor --
	// see CAL_TABLES_WITH_SERVICE_EVENT) -- null means no certificate
	// uploaded, not that certificates aren't supported.
	documentId?: number | null;
	// Original filename for documentId, same "what the link's text
	// shows" role as ServicingEvent.documentName.
	documentName?: string | null;
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
// mission's own deployment date, so an old mission shows the calibration
// that was actually in effect on it, not whatever the sensor is
// calibrated to now.
export interface ScienceSensorRecord {
	assetId: number;
	assetType: string;
	serialNumber: string | null;
	// Where it sits on the glider (see OPTIONAL_POSITIONS in the dashboard's
	// asset-positions.ts); null when not recorded. The Seaglider drawing
	// places sensors by it.
	position: string | null;
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

// Result of scraping an uploaded certificate PDF for coefficients --
// "Read in certificate" in the calibration dialog. recognized: false
// means the parser didn't know this facility/model combination (or
// couldn't find a date/coefficients on it); reason is shown to the
// user rather than silently failing.
export interface ParsedCertificate {
	recognized: boolean;
	reason?: string;
	model?: string;
	facility?: string;
	calDate?: string;
	coefficients?: Record<string, number>;
}

// One row of the Calibrations catalogue -- unlike ScienceSensorRecord
// (one calibration per sensor, as of one date), this is the FULL history:
// every calibration ever recorded for the asset, not just the one in
// effect on some mission. `facility` is pulled out of `coefficients`
// separately since the catalogue gives it its own sortable column.
export interface CalibrationCatalogueRow {
	id: number;
	assetId: number;
	// Denormalized from the surrounding CalibrationCatalogueTypeGroup so
	// a row carries everything an edit dialog needs (which cal table/
	// column set applies) without the caller having to thread it down
	// through ModelSection/ModelCalibrationTable separately.
	assetType: string;
	serialNumber: string | null;
	calDate: string;
	facility: string | null;
	// Only ct_sensor's cal table has a notes column today -- null for
	// every other asset type, same as facility being null wherever it
	// was never recorded.
	notes: string | null;
	coefficients: Record<string, number | string | null>;
	// Only set for asset types whose cal table has a service_event_id
	// link to hang a certificate off (see CAL_TABLES_WITH_SERVICE_EVENT)
	// -- null means no certificate uploaded, not that certificates
	// aren't supported for this row.
	certificateDocumentId: number | null;
	// Original filename for certificateDocumentId, same role as
	// ServicingEvent.documentName -- what the catalogue/accordion link
	// text shows instead of a generic "PDF".
	certificateDocumentName: string | null;
}

export interface CalibrationCatalogueModelGroup {
	// null groups every row with no NVS L22 model recorded yet.
	modelId: number | null;
	model: string | null;
	modelUri: string | null;
	rows: CalibrationCatalogueRow[];
}

// One asset type's section of the catalogue (ct_sensor, do_sensor,
// eco_sensor, mr_sensor -- the "sensor" asset_type_group; slocum_
// forward_section has a cal table too but is structural, not science,
// so it's deliberately excluded from this catalogue).
export interface CalibrationCatalogueTypeGroup {
	assetType: string;
	models: CalibrationCatalogueModelGroup[];
}

// The asset_service_event_types this feature exposes -- deliberately a
// subset: calibration has its own dedicated flow (CalibrationCatalogueRow
// above), and pressure_test / inspection / refurb / deployment_config
// aren't surfaced here. `missing` and `destroyed` are state-change events
// more than "servicing" (the table is really an asset activity/state
// timeline); `destroyed` is terminal and also stamps
// Glider.decommissionedDate -- see docs/design/derived-glider-status.md.
export type ServicingEventType =
	| "servicing"
	| "factory_repair"
	| "transit"
	| "on_loan"
	| "field_test"
	| "missing"
	| "destroyed"
	// Glider-only in the Add event dialog -- a full lab servicing pass
	// done specifically ahead of an upcoming mission, distinct from
	// routine "servicing".
	| "pre_mission_servicing"
	// A FLAG, not a state: needs serious repair, do not deploy. Open until
	// resolved (end date), and stays on the timeline afterwards.
	| "servicing_required";

// One open "servicing required" flag: an asset that must not be deployed until
// repaired. Listed on the home page, shown as a chip on the asset/glider, and
// resolved (end date set -- the event stays on the timeline) when fixed.
export interface ServicingRequired {
	eventId: number;
	assetId: number;
	assetType: string;
	// The glider's name, or an equipment asset's own name; null otherwise.
	assetName: string | null;
	serialNumber: string | null;
	// What is wrong, in a line, and in full.
	title: string | null;
	details: string | null;
	// YYYY-MM-DD it was raised.
	startDate: string;
}

export interface ResolveServicingRequiredInput {
	// YYYY-MM-DD, defaults to today.
	date?: string;
	// What was done; appended to the event's description.
	note?: string;
}

export interface ServicingEventTypeOption {
	id: number;
	name: ServicingEventType;
	description: string | null;
}

// What PATCH /assets/:id/decommission takes. `decommissionedDate: null`
// clears it (return to service). Applies to any asset; only gliders
// surface it in the UI today.
export interface DecommissionInput {
	decommissionedDate: string | null;
	reason?: string | null;
	// Retiring only (ignored on return-to-service). The reviewed set of
	// this glider's currently attached components that retire WITH it
	// (decommissioned, assignment left open). Anything else the live
	// build tree contains is freed up instead (not decommissioned,
	// assignment closed). `[]` means "free up everything"; omit entirely
	// to skip build-tree handling. Server-validated against the live
	// build tree either way.
	childAssetIds?: number[];
}

// One servicing event for one asset -- factory servicing, transit, or
// in-house/lab servicing (the "servicing" type name covers in-house;
// there's no separate DB value for it). `endDate: null` means the event
// is still open/in-progress; an asset can have at most one open event
// at a time (enforced by ServicingService, not the DB).
export interface ServicingEvent {
	id: number;
	assetId: number;
	eventType: ServicingEventType;
	title: string | null;
	startDate: string;
	endDate: string | null;
	details: string | null;
	performedByContactId: number | null;
	performedByName: string | null;
	documentId: number | null;
	// Original filename (not the on-disk UUID-prefixed reference, see
	// documents.service.ts's originalNameFromReference) -- what the
	// timeline/servicing tables link with, so the link reads as
	// "cert_2026.pdf" instead of a generic "PDF"/"Attached document".
	// Null exactly when documentId is.
	documentName: string | null;
}

// Everything the Add/Edit Servicing Event dialog submits. endDate absent
// means "still open" -- ServicingService rejects a new event for an
// asset that already has one open.
export interface RecordServicingEventInput {
	eventType: ServicingEventType;
	title: string;
	startDate: string;
	endDate?: string;
	performedByContactId?: number;
	details?: string;
	// New destroyed / missing events only: also close this open mission of the
	// glider in the same save (-> "killed in action" / "missing in action").
	// For destroyed, `closeMissionSetEndDate` also makes the event date the
	// mission's end (retrieval) date -- right for a glider destroyed during
	// recovery, wrong for one lost at sea.
	closeMissionId?: number;
	closeMissionSetEndDate?: boolean;
	// New destroyed events only: components of the glider's last build to take
	// down with it (optional; none by default).
	childAssetIds?: number[];
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
	// Same null-vs-empty convention as calibrations -- null means this
	// component has never been linked to an RMA at all, not that it was
	// checked and found to have none.
	rmas: AssetRmaSummary[] | null;
}

// A filtered, curated view of norglider_missions for one glider — the
// Deployment History table on the glider detail page, not the full
// missions catalogue's column set.
export interface GliderDeployment {
	id: number;
	missionNumber: number | null;
	stdMissionName: string | null;
	status: string | null;
	observatory: string | null;
	deploymentDate: string | null;
	retrievalDate: string | null;
	dives: number | null;
	distanceKm: number | null;
}

// rma_events.event_type -- a bespoke CHECK-constrained vocabulary
// (asset_faults.status/severity's precedent for a smaller, case-specific
// set), not a full lookup table like asset_service_event_types.
export type RmaEventType =
	| "opened"
	| "shipped_out"
	| "received_by_repairer"
	| "status_update"
	| "escalated_to_manufacturer"
	| "shipping_issue"
	| "received_by_manufacturer"
	| "returned"
	| "closed";

// The RMA case header -- who issued it (manufacturers, reused rather
// than inventing a vendor table: a repair facility and a manufacturer
// are the same kind of entity) and, if one was issued, the manufacturer's
// own case number. Status is never stored here -- see
// current_rma_status/RmaCatalogueRow.currentStage.
export interface Rma {
	id: number;
	rmaNumber: string | null;
	manufacturerId: number;
	manufacturerName: string;
	openedDate: string;
	notes: string | null;
}

// Which assets an RMA covers, and *why* -- one row per asset, since two
// assets on the same case (e.g. two different hulls) commonly have
// completely different failure reasons.
export interface RmaAsset {
	id: number;
	rmaId: number;
	assetId: number;
	assetSerialNumber: string | null;
	// Drives whether the linked-assets table's row links to /assets/:id
	// or /gliders/:id -- same "glider is an asset too" distinction
	// Asset.assetType already carries elsewhere.
	assetType: string;
	reason: string;
}

// One step in an RMA's own rich sub-timeline -- shipped out, received by
// the repairer, escalated to the manufacturer, a shipping issue, an
// arrival confirmation, eventually closed. Only ever shown on the RMA's
// own page, never as part of an asset's thin history feed (see
// AssetRmaSummary below).
export interface RmaEvent {
	id: number;
	rmaId: number;
	eventType: RmaEventType;
	eventDate: string;
	facilityId: number | null;
	facilityName: string | null;
	referenceNumber: string | null;
	notes: string | null;
	documentId: number | null;
	documentName: string | null;
}

// One row for the /rmas catalogue. currentStage/open are derived from
// current_rma_status (whichever RmaEvent is most recent), never stored
// -- same philosophy as docs/design/derived-glider-status.md.
export interface RmaCatalogueRow {
	id: number;
	rmaNumber: string | null;
	manufacturerName: string;
	openedDate: string;
	currentStage: RmaEventType;
	open: boolean;
	assetCount: number;
	assetSerials: string[];
}

// The *thin* feed for an asset's own history (asset detail page timeline
// + accordion, glider Timeline tab) -- deliberately excludes the rich
// rma_events sub-timeline, which only ever shows on the RMA's own page.
// openedDate/closedDate exist purely so this can be placed on a
// TimelineEvent (chart placement needs real dates); closedDate is only
// ever set once currentStage is "closed".
export interface AssetRmaSummary {
	rmaId: number;
	rmaNumber: string | null;
	reason: string;
	currentStage: RmaEventType;
	open: boolean;
	openedDate: string;
	closedDate: string | null;
}

export interface CreateRmaInput {
	rmaNumber?: string | null;
	manufacturerId: number;
	openedDate: string;
	notes?: string | null;
}

// Full-replace PATCH -- every field optional, an omitted one keeps its
// current value (COALESCE-based update, same as UpdateAssetInput).
export interface UpdateRmaInput {
	rmaNumber?: string | null;
	manufacturerId?: number;
	openedDate?: string;
	notes?: string | null;
}

export interface LinkRmaAssetInput {
	assetId: number;
	reason: string;
}

export interface UpdateRmaAssetReasonInput {
	reason: string;
}

// Everything the Add/Edit RMA event dialog submits. Mirrors
// RecordServicingEventInput's shape.
export interface RecordRmaEventInput {
	eventType: RmaEventType;
	eventDate: string;
	facilityId?: number | null;
	referenceNumber?: string | null;
	notes?: string | null;
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

// The three actions the build editor can take on a mission's build.
// "replace" swaps the asset in an existing item (keeping its position and
// anything mounted in it), "remove" deletes the item (and what is mounted
// in it), "add" creates one. All changes in one request are applied as a
// single transaction. "replace"/"add" take exactly one of childAssetId
// (existing asset) or newAsset (create it first, same transaction).
export interface BuildChangeReplace {
	action: "replace";
	itemId: number;
	childAssetId?: number;
	newAsset?: NewAssetInput;
}

export interface BuildChangeRemove {
	action: "remove";
	itemId: number;
	// Setting a status alongside the removal is optional -- most removals
	// happen because the part is going somewhere specific (calibration,
	// factory repair), but not always known at entry time.
	newStatusId?: number | null;
	statusNotes?: string | null;
}

export interface BuildChangeAdd {
	action: "add";
	// The glider's asset id for something mounted directly on it, or the
	// asset id of a part already in this mission's build (e.g. a payload bay).
	parentAssetId: number;
	childAssetId?: number;
	newAsset?: NewAssetInput;
	position?: string | null;
}

// Moves a part to another location on the glider, in place. null clears it.
export interface BuildChangeSetPosition {
	action: "setPosition";
	itemId: number;
	position: string | null;
}

export type BuildChange =
	| BuildChangeReplace
	| BuildChangeRemove
	| BuildChangeAdd
	| BuildChangeSetPosition;

export interface ApplyBuildChangesInput {
	notes?: string | null;
	changes: BuildChange[];
}

// What deleting a servicing event reports back. `returnedToService` is true
// when it was a `destroyed` event whose decommission it had applied: that
// decommission is removed with it.
export interface DeleteServicingEventResult {
	returnedToService: boolean;
	// Components that went down with that destruction and were brought back.
	componentsReturned: number;
}

export interface ApplyBuildChangesResult {
	// Soft problems the save went through with, e.g. a sensor that is also in
	// another glider's open mission build. Two ACTIVE builds claiming the same
	// asset is refused outright instead.
	warnings: string[];
}

// Copy another mission's build over this one (replacing it).
export interface CopyBuildInput {
	sourceMissionId: number;
}

// A mission as the glider page refers to it.
export interface BuildMissionRef {
	id: number;
	missionNumber: number | null;
	missionName: string | null;
	stdMissionName: string | null;
	status: string | null;
	deploymentDate: string | null;
	retrievalDate: string | null;
}

// One mission's build: what was (or will be) on the glider for it.
export interface MissionBuild {
	// False when nothing is on record for this mission yet ("build not
	// recorded"), as opposed to a recorded build that happens to be empty.
	recorded: boolean;
	components: GliderBuildComponent[];
	// Science sensors, with the calibration in effect on the mission's deployment
	// date (today, for a mission that has not deployed).
	sciencePayload: ScienceSensorRecord[];
	warnings: string[];
}

export interface GliderBuild {
	// The build of the last mission that flew (see buildMission) -- a
	// read-only view. Builds are edited on their mission.
	components: GliderBuildComponent[];
	componentDetails: GliderComponentDetail[];
	sciencePayload: ScienceSensorRecord[];
	// Which mission the build above belongs to; null when the glider has not
	// flown (or no deployed mission has a build on record).
	buildMission: BuildMissionRef | null;
	// The mission being prepared for this glider: its workshop, or else its
	// earliest scheduled mission. null when nothing is planned.
	nextMission: BuildMissionRef | null;
	// What the glider page's "Current build" panel actually displays:
	// nextMission's build while one is being prepped (workshop/scheduled),
	// otherwise the same as buildMission/components/componentDetails/
	// sciencePayload above. Kept separate from those three -- which stay
	// pinned to the last flown build for the Timeline tab's history and
	// edit log -- so a build still being drafted in the workshop doesn't
	// change what the glider's history says it actually flew with.
	currentBuildMission: BuildMissionRef | null;
	currentBuildComponents: GliderBuildComponent[];
	currentBuildComponentDetails: GliderComponentDetail[];
	currentSciencePayload: ScienceSensorRecord[];
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
	/** IMO ship number: seven digits, permanent for the hull. Null for small boats that have none. */
	vesselImoNumber: string | null;
	agency: string | null;
	// Plain text in the DB, not linked to contacts like missions' PI/operations manager
	// are — surfaced as-is. Deliberately not called "pi": a cruise leader
	// isn't the same role as a mission's PI.
	cruiseLeader: string | null;
	area: string | null;
	startDate: string;
	endDate: string;
	startPort: string | null;
	endPort: string | null;
}

export interface CreateCruiseInput {
	cruiseName: string;
	cruiseNumber?: string | null;
	vesselId?: number | null;
	agencyId?: number | null;
	cruiseLeader?: string | null;
	area: string;
	startDate: string;
	endDate: string;
	startPort?: string | null;
	endPort?: string | null;
}

// --- Iridium airtime costs ------------------------------------------
// Read-only, from OGDB's iridium_* views (migration xxxx_iridium_costs),
// filled monthly by norgliders-utils/iridium-costs `push`. USD is what
// Metocean billed; NOK is an estimate at Norges Bank's monthly average.

export type IridiumCategory =
	| "mission_usage"
	| "mission_rental"
	| "after_recovery"
	| "before_launch"
	| "idle_usage"
	| "idle_rental";

export interface IridiumSummary {
	/** null until the first push. */
	lastRun: {
		runAt: string;
		toolVersion: string;
		invoicesRead: number;
		firstMonth: string | null; // "YYYY-MM"
		lastMonth: string | null; // "YYYY-MM"
		totalUsd: number;
		warnings: string[];
	} | null;
	totalNok: number | null;
	/** USD/NOK for the latest invoiced month, for converting estimates. */
	latestRate: { month: string; usdNok: number } | null;
}

export interface IridiumMissionCost {
	missionId: number;
	missionNumber: number;
	stdMissionName: string;
	status: string | null;
	gliderAssetId: number | null;
	gliderName: string | null;
	platform: string | null;
	deploymentDate: string;
	retrievalDate: string | null;
	durationDays: number;
	missionMonths: number;
	invoicedMonths: number;
	/** false = months without an invoice, so the total is too low (†). */
	fullyInvoiced: boolean;
	missionUsageUsd: number;
	missionRentalUsd: number;
	afterRecoveryUsd: number;
	beforeLaunchUsd: number;
	totalUsd: number;
	totalNok: number | null;
	usdPerDay: number | null;
	/** "YYYY-MM" months with >= $1 of airtime after retrieval / before deployment. */
	leftOnMonths: string[];
	preLaunchMonths: string[];
}

/** Fleet totals per month, platform and category (both accounts). */
export interface IridiumMonthlyCost {
	month: string; // "YYYY-MM"
	platform: string; // "slocum" | "seaglider" | "unassigned"
	category: IridiumCategory;
	usd: number;
	nok: number | null;
}

/** One glider's cost in one month (last 12 invoiced months). */
export interface IridiumGliderMonth {
	gliderAssetId: number;
	gliderName: string;
	platform: string;
	month: string; // "YYYY-MM"
	usd: number;
	/** The part charged to a mission (usage, rental, before/after). */
	missionUsd: number;
}

/** One mission's cost in one month, by category. */
export interface IridiumMissionMonth {
	month: string; // "YYYY-MM"
	missionUsageUsd: number;
	missionRentalUsd: number;
	beforeLaunchUsd: number;
	afterRecoveryUsd: number;
}

export interface IridiumMissionDetail {
	/** null if the mission ended before the invoice record starts. */
	cost: IridiumMissionCost | null;
	months: IridiumMissionMonth[];
}

// Mission data bundle (docs/mission-data-bundle.md §8) -- the Zarr stores
// behind the mission data page. Store URLs carry the build id, so a new
// upload gives new URLs and the browser can cache store files forever.
export interface MissionBundleSummary {
	available: boolean; // false: no bundle uploaded yet
	stale: boolean; // built from a different L2 file than the one now live on ERDDAP
	buildId: string | null;
	builtAt: string | null;
	sourceL2File: string | null;
	publicStoreUrl: string | null; // "/api/missions/23/bundle/<buildId>/public.zarr"
	staffStoreUrl: string | null; // null unless the caller is editor/admin
	erddapL2Url: string | null;
}

// One profile at full resolution, from ERDDAP (§8.3).
export interface FullResolutionProfile {
	profileIndex: number;
	time: string;
	depth: number[];
	values: Record<string, (number | null)[]>;
	units: Record<string, string>;
}

// Where each section of the logsheet stands. `complete` means nothing is left
// to do AND someone has recorded something there.
export type RefurbSectionKey =
	| "intake"
	| "inspections"
	| "sensors"
	| "batteries"
	| "device_tests"
	| "vacuum"
	| "tank_test"
	| "selftest"
	| "software"
	| "field_test"
	| "final_prep";

export interface RefurbSectionState {
	key: RefurbSectionKey;
	// The field test is the only section that is not required.
	required: boolean;
	started: boolean;
	complete: boolean;
	// What is still to do in this section, in words.
	blockers: string[];
	// Who last SAVED something in this section, and when. Per section, not per
	// field, and only a successful save updates it. Null until first saved.
	lastEditedAt: string | null;
	lastEditedByName: string | null;
}

// One entry in a logsheet's clearance history. Clearing locks the logsheet;
// unlocking withdraws the clearance and must give a reason.
export interface RefurbClearanceEvent {
	id: number;
	action: "cleared" | "unlocked";
	at: string;
	byName: string | null;
	reason: string | null;
}

// Header of a Seaglider pre-mission refurbishment logsheet
// (refurbishments table). One per mission, normally the glider's workshop
// mission. See docs/design/seaglider-refurb-logsheet.md.
export interface Refurbishment {
	id: number;
	missionId: number;
	formVersion: number;
	// Identity comes from the mission's glider, never typed on the form.
	gliderAssetId: number;
	gliderName: string;
	serialNumber: string | null;
	startedAt: string;
	startedByName: string | null;
	// Cleared to deploy: set together or not at all.
	clearedAt: string | null;
	clearedByName: string | null;
	// Why "cleared to deploy" is not available yet. Empty when it can be set.
	clearBlockers: string[];
	// Every section's state, in logsheet order: drives the progress bar.
	sections: RefurbSectionState[];
	// Cleared for deployment = locked: nothing in the logsheet can change.
	// Newest first.
	clearanceHistory: RefurbClearanceEvent[];
}

// One pitch-gain position in a tank run: the pitch battery position (cm)
// and the pitch angle read from the compass (deg). Order = point number.
export interface TankRunPitchPoint {
	pitchCm: number;
	pitchDeg: number;
}

// CT reading in the tank for one fitted sensor, compared by the tech with
// the reference sensor.
export interface TankRunCtReading {
	sensorLabel: string;
	tempC: number | null;
	salinityPsu: number | null;
}

// Everything a tech types into one tank run. All nullable: a run is filled
// in over hours by several people, and "complete" is only checked at
// sign-off. Units follow the field names; density is kg/m3, not g/cc.
export interface TankRunValues {
	runDate: string | null; // YYYY-MM-DD
	isFinal: boolean;
	argosMounted: boolean | null;
	weightAirKg: number | null;
	// Initial readings
	pitchAd: number | null;
	pitchCm: number | null;
	rollAd: number | null;
	rollDeg: number | null;
	vbdAd: number | null;
	vbdCc: number | null;
	internalRh: number | null;
	internalTempC: number | null;
	internalPressurePsia: number | null;
	// Roll and pitch checks
	rollAngleDeg: number | null;
	rollOk: boolean | null;
	rollAdjustment: string | null;
	pitchAngleDeg: number | null;
	pitchOk: boolean | null;
	pitchAdjustment: string | null;
	// Tank water
	tankTempC: number | null;
	tankSalinityPsu: number | null;
	tankDensityKgm3: number | null;
	ctOk: boolean | null;
	// Ballast
	targetMaxDensityKgm3: number | null;
	desiredTankWeightG: number | null;
	measuredTankWeightG: number | null;
	ballastChanges: string | null;
	// Final trim values (saved on sign-off of the final run)
	trimMassKg: number | null;
	trimCVbdAd: number | null;
	trimCPitchAd: number | null;
	trimCRollAd: number | null;
	notes: string | null;
	pitchPoints: TankRunPitchPoint[];
	ctReadings: TankRunCtReading[];
}

export interface TankRun extends TankRunValues {
	id: number;
	refurbishmentId: number;
	runNumber: number;
	createdAt: string;
	createdByName: string | null;
	updatedAt: string;
	updatedByName: string | null;
	signedOffAt: string | null;
	signedOffByName: string | null;
}

// A battery the tech can pick as the replacement in a refurbishment: a
// battery asset whose model is for this glider's platform.
export interface RefurbBatteryCandidate {
	id: number;
	serialNumber: string | null;
	model: string | null;
	dateOfManufacture: string | null;
	// Ah and V, from the battery model.
	capacityAh: number | null;
	nominalVoltage: number | null;
}

// What the tech enters for one battery slot. Weights in g, voltages in V.
export interface RefurbBatteryPackValues {
	installedAssetId: number | null;
	installedOn: string | null; // YYYY-MM-DD
	installedWeightG: number | null;
	installedVoltageV: number | null;
	removedWeightG: number | null;
	removedVoltageV: number | null;
	notes: string | null;
}

// One battery slot of the refurbishment. `buildAssetId` is what the mission's
// build holds in that slot right now; `removedAssetId` is what was there when
// the tech first saved the slot (kept, so a later save still knows the old pack).
export interface RefurbBatteryPack extends RefurbBatteryPackValues {
	position: string; // fore | middle | aft
	buildAssetId: number | null;
	removedAssetId: number | null;
	// Calculated once when saved, never against today's date. Fractions 0–1.
	derating: number | null;
	remaining: number | null;
	// Ah to enter as $AH0_<V>V in pdos.
	fuelGaugeAh: number | null;
	saved: boolean;
	updatedAt: string | null;
	updatedByName: string | null;
}

export interface RefurbBatteryChecks {
	fuelGaugesReset: boolean;
	ah0Updated: boolean;
	gpsCellReplaced: boolean | null;
	gpsCellManufactured: string | null; // YYYY-MM-DD
	updatedAt: string | null;
	updatedByName: string | null;
}

export interface RefurbBatteries {
	packs: RefurbBatteryPack[];
	candidates: RefurbBatteryCandidate[];
	// Every battery named by a pack (installed, removed or in the build), so
	// the UI can show serial and model without a second lookup.
	assets: RefurbBatteryCandidate[];
	checks: RefurbBatteryChecks;
}

// One device in the refurbishment's Device tests. The list of expected
// devices is built from the glider (the built-in four) and the mission's
// build (each fitted science sensor), never typed in.
export interface RefurbDeviceTest {
	// "altimeter" | "compass" | "gps" | "pressure_sensor" | "sensor-<assetId>"
	key: string;
	label: string;
	// Serial and model, for a science sensor.
	detail: string | null;
	kind: "builtin" | "sensor";
	// Reminder from the procedure, e.g. when the device is calibrated.
	hint: string | null;
	result: "pass" | "fail" | null;
	note: string | null;
	updatedAt: string | null;
	updatedByName: string | null;
}

export interface RefurbDeviceTests {
	devices: RefurbDeviceTest[];
}

// Sensors: the science sensors fitted for this mission (read from the build, so
// the list cannot disagree with it), what each replaced, and the checks from
// the old sheet. The calibration itself is not stored here: it has its own
// records, and the logsheet reads the latest.
export interface RefurbSensor {
	assetId: number;
	assetType: string;
	typeLabel: string;
	serialNumber: string | null;
	model: string | null;
	position: string | null;
	// Latest calibration on record for the sensor (from its own cal table).
	calibrationDate: string | null;
	// Set when the sensor was put in during this refurbishment: what it replaced
	// ("CT sensor 191"), or null if the slot was empty.
	replaced: boolean;
	replacedLabel: string | null;
	// CT sail only: the zero-conductivity frequency must be checked.
	requiresZeroFrequency: boolean;
	// Someone has looked at this sensor (its calibration date and condition).
	reviewed: boolean;
	coefficientsOk: boolean;
	zeroFrequencyOk: boolean;
	needsCalibration: boolean;
	notes: string | null;
	updatedAt: string | null;
	updatedByName: string | null;
}

export interface RefurbSensorCandidate {
	id: number;
	assetType: string;
	label: string;
}

export interface RefurbSensors {
	sensors: RefurbSensor[];
	// Sensors that could be put in: not decommissioned, not already in this build.
	candidates: RefurbSensorCandidate[];
}

// Selftests and field tests have their own software, so the logsheet does not
// re-implement them. It records that the test was done (and by whom) and keeps
// links to it there. There are usually several selftests, so links are a list.
// A selftest is required before clearing; a field test never is.
export type RefurbTestKind = "selftest" | "field_test";

export interface RefurbTestLink {
	id: number;
	kind: RefurbTestKind;
	url: string;
	// Optional name to tell links apart, e.g. "Selftest 3, outdoors".
	label: string | null;
	addedAt: string;
	addedByName: string | null;
}

export interface RefurbTestGroup {
	// Confirmed as done: who first confirmed it, and when.
	confirmed: boolean;
	confirmedAt: string | null;
	confirmedByName: string | null;
	links: RefurbTestLink[];
}

export interface RefurbTestLinks {
	selftest: RefurbTestGroup;
	fieldTest: RefurbTestGroup;
}

// An Argos tag's configuration: fixed facts that identify it, held on the tag
// asset itself (asset_argos_tag_details), so they are entered once and reused
// by every mission it flies on.
export interface ArgosTagConfig {
	assetId: number;
	serialNumber: string | null;
	// Tag type, e.g. "SPOT6".
	model: string | null;
	// Argos decimal ID (the PTT ID): 6 to 8 digits. One tag per ID.
	argosDec: string | null;
	// Argos hex ID: 6 or 7 hex digits, uppercase. One tag per ID.
	argosHex: string | null;
	tagName: string | null;
}

// What is typed in for one test of a tag, replacing the old Tag Agent
// screenshot. Held in the tag's measurement history
// (asset_argos_tag_measurements), so every test of every tag stays on record.
export interface ArgosTagTestValues {
	// e.g. "1.0b-7311".
	tagwareVersion: string | null;
	txAttempts: number | null;
	// Of those attempts, how many failed (never more than the attempts).
	txFailCount: number | null;
	batteryVoltage: number | null;
	transmissionTestPassed: boolean | null;
}

export interface ArgosTagTest extends ArgosTagTestValues {
	// The measurement row this logsheet recorded; null until first saved.
	measurementId: number | null;
	measuredDate: string | null;
}

// One row of a tag's measurement history, for the asset page.
export interface ArgosTagMeasurement extends ArgosTagTestValues {
	id: number;
	measuredDate: string;
	notes: string | null;
	changedByName: string | null;
}

export interface ArgosTagDetail {
	config: ArgosTagConfig;
	// Newest first.
	measurements: ArgosTagMeasurement[];
}

// Intake: what went wrong on the previous mission (read from the mission and
// the fault log, never typed) and retiring the old Argos tag.
export interface RefurbIntakeFault {
	id: number;
	// "ct_sensor 9545", the glider's name, and so on.
	assetLabel: string;
	reportedDate: string;
	severity: string;
	status: string;
	description: string;
}

export interface RefurbIntakePreviousMission {
	id: number;
	missionNumber: number | null;
	name: string;
	retrievalDate: string | null;
	// The mission's own "why it ended" (OceanOPS vocabulary); null if not set.
	endingCause: string | null;
}

export interface RefurbIntakeValues {
	issuesReviewed: boolean;
	issuesNotes: string | null;
	// The tag that flew on the previous mission (an `argos_tag` asset).
	oldTagAssetId: number | null;
	tagRemoved: boolean;
	tagActivated: boolean;
	tagStopped: boolean;
}

export interface RefurbIntake extends RefurbIntakeValues {
	previousMission: RefurbIntakePreviousMission | null;
	// Unresolved faults on the glider and on what is in this mission's build.
	openFaults: RefurbIntakeFault[];
	// Every tag that could be chosen, with its saved configuration.
	tagCandidates: ArgosTagConfig[];
	// The readings typed in for this test of the tag (held in the tag's
	// measurement history). The tag's own details are managed on the asset.
	tagTest: ArgosTagTest;
	updatedAt: string | null;
	updatedByName: string | null;
}

// Software track: confirming the basestation and the three gliderpage
// servers are clean (before the sim dives, and again after), running the sim
// dives, and putting the mission files in place. The commands are in the
// SOP; the logsheet only records who confirmed what, and when.
export type SoftwareCleanupStage = "after_previous_mission" | "after_simdives";
export type SoftwareCleanupTarget =
	| "backup"
	| "basestation"
	| "gliders"
	| "glider"
	| "gp";

export interface RefurbSoftwareCleanup {
	stage: SoftwareCleanupStage;
	target: SoftwareCleanupTarget;
	done: boolean;
	// Who first confirmed it, and when. Null while not done.
	doneAt: string | null;
	doneByName: string | null;
}

export interface RefurbSoftwareValues {
	// The old mission's files copied off the glider's flash card into
	// /naco/data/delayed/, then the card formatted. Formatting needs the copy
	// first (the database refuses it otherwise): it destroys what is on the card.
	flashcardCopied: boolean;
	flashcardFormatted: boolean;
	simdiveCmdfileUploaded: boolean;
	simdiveScienceUploaded: boolean;
	// Number of simulated dives completed (about 3 is normal).
	simdiveDives: number | null;
	// Dive plot, science sensors, GaaG, GPS and pop-up window all look right,
	// and show up properly in the gliderpage.
	simdiveDataOk: boolean;
	simdiveGliderOff: boolean;
	simdiveNotes: string | null;
	filesScience: boolean;
	filesCmdfile: boolean;
	filesTargets: boolean;
	filesCalibConstants: boolean;
	filesPagersUrlsLogout: boolean;
	filesOther: string | null;
}

export interface RefurbSoftware extends RefurbSoftwareValues {
	// Every stage × target, in checklist order.
	cleanups: RefurbSoftwareCleanup[];
	updatedAt: string | null;
	updatedByName: string | null;
}

// What the tech enters in Final prep. The packing flags are the logsheet's
// own fixed checklist.
export interface RefurbFinalPrepValues {
	pressureFinalPsia: number | null;
	travelModeSet: boolean;
	gliderOff: boolean;
	// The Argos tag going out on this mission (an `argos_tag` asset).
	argosAssetId: number | null;
	tagTimeSynced: boolean;
	tagConfigConfirmed: boolean;
	tagAutoStart: boolean;
	packTagClamps: boolean;
	packCommsCable: boolean;
	packShortingOrWand: boolean;
	packWings: boolean;
	packRudder: boolean;
	packCradle: boolean;
	packSpareKit: boolean;
	packReleaseMechanism: boolean;
	packPc: boolean;
	notes: string | null;
}

export interface RefurbFinalPrep extends RefurbFinalPrepValues {
	// Every tag that could be chosen, with its saved configuration.
	tagCandidates: ArgosTagConfig[];
	// The readings typed in for this test of the tag (held in the tag's
	// measurement history). The tag's own details are managed on the asset.
	// The tag's limits from the procedure: battery 3.3 to 3.7 V, fewer than
	// 40 000 transmission attempts.
	tagTest: ArgosTagTest;
	updatedAt: string | null;
	updatedByName: string | null;
}

// One line of the inspection checklists. `check` items are looked at and
// marked OK, needs work or repaired; `step` items are just done. The list of
// items is the logsheet's own and is fixed (it lives in the gateway).
export interface RefurbInspectionItem {
	key: string;
	phase: "external" | "internal";
	kind: "check" | "step";
	label: string;
	hint: string | null;
	status: "ok" | "issue" | "repaired" | "done" | null;
	note: string | null;
	updatedAt: string | null;
	updatedByName: string | null;
}

export interface RefurbInspection {
	items: RefurbInspectionItem[];
}

// Close and vacuum (refurb_vacuum): one record per refurbishment. Pressures
// in psia (about 14 before pulling, about 9 ± 0.2 after).
export interface RefurbVacuum {
	cablesChecked: boolean;
	oringsServiced: boolean;
	gliderClosed: boolean;
	vacuumPulled: boolean;
	pressureBeforePsia: number | null;
	pressurePulledPsia: number | null;
	// After leaving it to settle (about 5 min).
	pressureSettledPsia: number | null;
	humidityRh: number | null;
	anodeContinuityOk: boolean | null;
	notes: string | null;
	updatedAt: string | null;
	updatedByName: string | null;
}
