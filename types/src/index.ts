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
