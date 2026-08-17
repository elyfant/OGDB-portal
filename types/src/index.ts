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
	platformCategory: string | null;
	serialNumber: string | null;
	owner: string | null;
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
