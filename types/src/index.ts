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
	package: string | null;
	versionUrl: string | null;
	// Not tracked yet — schema has the columns (qc_occurred_at/qc_who_id) but
	// nothing populates them in practice. Always null for now.
	occurredAt: string | null;
	who: string | null;
}

export interface DatasetProcessingStageDetail {
	stage: DatasetProcessingStage;
	// "raw" has no package/version/QC/OG1/download concept at all — the
	// dashboard renders those as "n/a" rather than "not done yet" for it.
	applicable: boolean;
	status: boolean;
	who: string | null;
	occurredAt: string | null;
	package: string | null;
	versionUrl: string | null;
	qc: DatasetProcessingStageQc | null;
	isOg1: boolean | null;
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

export interface Mission {
	id: number;
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

export interface GliderBuild {
	components: GliderBuildComponent[];
	componentDetails: GliderComponentDetail[];
	deployments: GliderDeployment[];
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
