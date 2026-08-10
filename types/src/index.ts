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
	missionNumber: number | null;
	stdMissionName: string | null;
	status: string | null;
	glider: string | null;
	project: string | null;
	site: string | null;
	pi: string | null;
	platform: string | null;
	fundingAgency: string | null;
	launchDate: string | null;
	recoveryDate: string | null;
	dives: number | null;
	distanceKm: number | null;
	numberOfDays: number | null;
}
