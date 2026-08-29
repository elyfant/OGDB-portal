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
	purchaseValueUsd: number | null;
	statusId: number | null;
	status: AssetStatus | null;
	statusEffectiveDate: string | null;
	// Raw FK ids alongside the resolved display strings above (platform,
	// owner) — needed to pre-select the right dropdown option when
	// editing, the same reason Mission exposes both siteId and site.
	platformId: number | null;
	instituteId: number | null;
}

export interface CreateGliderInput {
	name: string;
	wmo?: string | null;
	platformId?: number | null;
	serialNumber?: string | null;
	instituteId?: number | null;
	purchaseDate?: string | null;
	purchaseValueUsd?: number | null;
}

export interface UpdateGliderInput {
	name?: string;
	wmo?: string | null;
	platformId?: number | null;
	serialNumber?: string | null;
	instituteId?: number | null;
	purchaseDate?: string | null;
	purchaseValueUsd?: number | null;
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
	// asset_sensor_details.l22_model_id -- science sensors only (the raw
	// FK, not a resolved label, so the asset-edit form can pre-select the
	// current model in its L22 dropdown). Null for every other asset type.
	l22ModelId: number | null;
	purchaseDate: string | null;
	purchaseValueUsd: number | null;
	statusId: number | null;
	status: AssetStatus | null;
	statusEffectiveDate: string | null;
}

// The Batteries catalogue row -- assets of type "battery" with their
// battery-specific detail fields joined in (the generic "All assets"
// table has no source for model/manufacture date/weight). Weight is the
// latest asset_battery_measurements reading.
export interface Battery {
	id: number;
	serialNumber: string | null;
	institute: string | null;
	batteryModel: string | null;
	dateOfManufacture: string | null;
	weight: number | null;
	purchaseDate: string | null;
	purchaseValueUsd: number | null;
	statusId: number | null;
	status: AssetStatus | null;
	statusEffectiveDate: string | null;
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
export interface BatteryDetail {
	batteryModel: string | null;
	dateOfManufacture: string | null;
	measurements: BatteryMeasurement[];
}

// Generic fields only — every asset type has these, but only gliders
// (created via CreateGliderInput instead) have their own detail-table
// fields modeled yet. assetTypeId must not resolve to "glider".
export interface CreateAssetInput {
	assetTypeId: number;
	serialNumber?: string | null;
	notes?: string | null;
	purchaseDate?: string | null;
	purchaseValueUsd?: number | null;
	instituteId?: number | null;
	// Science sensors only -- ignored server-side for any other asset type.
	l22ModelId?: number | null;
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
	purchaseValueUsd?: number | null;
	// Science sensors only. Omit to leave unchanged; null clears it.
	l22ModelId?: number | null;
}

// "DM"/"PUB" replaced "L1"/"L2" (see xxxx_dataset_processing_dm_published.py
// in OGDB) -- the stage taxonomy tracks processing maturity (delayed mode
// vs. published) rather than output format, matching the NorGliders QC
// processing pipeline (both platforms produce their timeseries and
// gridded products together at each maturity step; format-specific
// links live on the external-references URLs instead).
export type DatasetProcessingStage = "raw" | "L0" | "DM" | "PUB";

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
	site: string | null;
	launchDate: string | null;
	recoveryDate: string | null;
	doi: string | null;
	oceanOpsBoardUrl: string | null;
	// NorGliders' own published ERDDAP endpoints -- distinct from
	// oceanOpsBoardUrl/coriolisUrl, which are the real-time feeds. The URL
	// is a stable address; *Status tracks what's currently live there --
	// "none" (nothing confirmed pushed yet), "DM" (delayed mode), or "PUB"
	// (published, which supersedes DM at the same URL). Backed by the
	// append-only erddap_pushes table, not dataset_processing directly.
	erddapL1Url: string | null;
	erddapL1Status: ErddapPushStatus;
	erddapL2Url: string | null;
	erddapL2Status: ErddapPushStatus;
	coriolisUrl: string | null;
	stages: DatasetProcessingStageDetail[];
	history: DatasetHistoryEntry[];
}

export type ErddapPushStatus = "none" | "DM" | "PUB";
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
	dmStatus: boolean;
	pubStatus: boolean;
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
	site: string | null;
	siteId: number | null;
	pi: string | null;
	principalInvestigatorId: number | null;
	tech: string | null;
	technicalLeadId: number | null;
	operatingAgency: string | null;
	operatingAgencyId: number | null;
	fundingAgency: string | null;
	fundingAgencyId: number | null;
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
	// Free-text pointers (path or URI) to the current best dataset for this
	// mission at each processing level -- the concatenated realtime file
	// during the mission, the archived location after archival, the
	// reprocessed file after manual QC. Not validated as real paths, and
	// no history is kept: moving the pointer overwrites it.
	l1File: string | null;
	l2File: string | null;
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
}

// A simple id/name reference option -- projects, sites, institutes,
// contacts. Shared shape since every lookup dropdown in the Add Mission
// dialog renders identically regardless of which table backs it.
export interface LookupOption {
	id: number;
	name: string;
}

// Everything the Add Mission dialog can submit. missionName is
// deliberately absent -- it's server-computed from
// glider/project/site/launchDate, never client-submitted, so it can't
// drift from the naming convention. statusId/gliderAssetId/projectId/
// siteId/launchDate are the only fields the dialog treats as required;
// everything else is nullable/omittable.
export interface CreateMissionInput {
	missionNumber: number;
	gliderAssetId: number;
	statusId: number;
	projectId: number;
	siteId: number;
	launchDate: string;
	principalInvestigatorId?: number | null;
	technicalLeadId?: number | null;
	operatingAgencyId?: number | null;
	fundingAgencyId?: number | null;
	launchLatitude?: number | null;
	launchLongitude?: number | null;
	launchCruiseId?: number | null;
	endDateScience?: string | null;
	recoveryDate?: string | null;
	recoveryLatitude?: number | null;
	recoveryLongitude?: number | null;
	recoveryCruiseId?: number | null;
	volume?: number | null;
	weightInAir?: number | null;
	density?: number | null;
	dives?: number | null;
	distanceKm?: number | null;
	iridiumMinutes?: number | null;
	l1File?: string | null;
	l2File?: string | null;
	// The new mission's initial build, applied in the same transaction as
	// the mission row itself -- omit/empty when the glider's current live
	// build already covers it (most redeployments need no changes at all).
	buildChanges?: BuildChange[];
}

export interface CreatedMission {
	id: number;
	missionNumber: number | null;
	missionName: string | null;
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
	// Only set for asset types whose cal table has a service_event_id
	// link to hang a certificate off (ct_sensor, do_sensor, eco_sensor --
	// see CAL_TABLES_WITH_SERVICE_EVENT) -- null means no certificate
	// uploaded, not that certificates aren't supported.
	documentId?: number | null;
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
	// Only ever set for ct_sensor rows (the only cal table with a
	// service_event_id link to hang a certificate off today) -- null
	// means no certificate uploaded, not that certificates aren't
	// supported for this row.
	certificateDocumentId: number | null;
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

// The controlled list for RecordServicingEventDto.eventType --
// deliberately a subset of asset_service_event_types: calibration has
// its own dedicated flow (CalibrationCatalogueRow above), and the rest
// (pressure_test, inspection, refurb, deployment_config) aren't
// exposed through this feature.
export interface ServicingEventTypeOption {
	id: number;
	name: "servicing" | "factory_repair" | "transit";
	description: string | null;
}

// One servicing event for one asset -- factory servicing, transit, or
// in-house/lab servicing (the "servicing" type name covers in-house;
// there's no separate DB value for it). `endDate: null` means the event
// is still open/in-progress; an asset can have at most one open event
// at a time (enforced by ServicingService, not the DB).
export interface ServicingEvent {
	id: number;
	assetId: number;
	eventType: "servicing" | "factory_repair" | "transit";
	title: string | null;
	startDate: string;
	endDate: string | null;
	details: string | null;
	performedByContactId: number | null;
	performedByName: string | null;
	documentId: number | null;
}

// Everything the Add/Edit Servicing Event dialog submits. endDate absent
// means "still open" -- ServicingService rejects a new event for an
// asset that already has one open.
export interface RecordServicingEventInput {
	eventType: "servicing" | "factory_repair" | "transit";
	title: string;
	startDate: string;
	endDate?: string;
	performedByContactId?: number;
	details?: string;
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

export interface CreateCruiseInput {
	cruiseName: string;
	cruiseNumber?: string | null;
	vesselId?: number | null;
	instituteId?: number | null;
	cruiseLeader?: string | null;
	area: string;
	startDate: string;
	endDate: string;
	startPort?: string | null;
	endPort?: string | null;
}
