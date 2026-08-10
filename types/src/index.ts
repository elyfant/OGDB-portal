export type AssetStatus =
	| "lab"
	| "in_house_repairs"
	| "factory_service"
	| "transit"
	| "deployed"
	| "on_loan"
	| "missing"
	| "decommissioned";

export interface Glider {
	id: number;
	name: string;
	wmo: string | null;
	platform: string | null;
	serialNumber: string | null;
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
