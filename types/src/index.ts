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
	serialNumber: string | null;
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
