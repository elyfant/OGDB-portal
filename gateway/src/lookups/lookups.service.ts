import { Inject, Injectable } from "@nestjs/common";
import type { LookupOption } from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";

// Simple id/name reference lists for dropdowns that don't have a home
// elsewhere -- one small module instead of four near-identical
// controller/service/module trios, since these are all the same shape
// (a lookup table with an id and a display name). Used by the Add
// Mission dialog's Project/Site/Principal investigator/Technical
// lead/Operating agency/Funding agency dropdowns; matches the short
// `name` column norglider_missions itself already displays (not
// long_name) for project/site/institute consistency.
@Injectable()
export class LookupsService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	async getProjects(): Promise<LookupOption[]> {
		const result = await this.pool.query(
			"SELECT id, name FROM projects ORDER BY name",
		);
		return result.rows;
	}

	async getSites(): Promise<LookupOption[]> {
		const result = await this.pool.query(
			"SELECT id, name FROM sites ORDER BY name",
		);
		return result.rows;
	}

	async getInstitutes(): Promise<LookupOption[]> {
		const result = await this.pool.query(
			"SELECT id, name FROM institutes ORDER BY name",
		);
		return result.rows;
	}

	async getContacts(): Promise<LookupOption[]> {
		const result = await this.pool.query(
			`SELECT id, TRIM(first_name || ' ' || last_name) AS name
       FROM contacts
       ORDER BY name`,
		);
		return result.rows;
	}

	// missions.status_id -> the legacy `status` table (active, recovered,
	// scheduled, transit, missing in action, ...) -- a completely
	// different table from asset_status_options (lab, deployed, ...),
	// despite the similar name. Mission-specific, so it lives here rather
	// than the asset-status-options module.
	async getMissionStatuses(): Promise<LookupOption[]> {
		const result = await this.pool.query(
			"SELECT id, name FROM status ORDER BY id",
		);
		return result.rows;
	}

	async getVessels(): Promise<LookupOption[]> {
		const result = await this.pool.query(
			"SELECT id, name FROM vessels ORDER BY name",
		);
		return result.rows;
	}

	async getAssetTypes(): Promise<LookupOption[]> {
		const result = await this.pool.query(
			"SELECT id, name FROM asset_types ORDER BY name",
		);
		return result.rows;
	}

	// Display name comes from the B76 NVS term (e.g. "Teledyne Webb
	// Research Slocum G3 glider"), not platforms.name/model (short
	// internal codes like "slocum"/"G3") -- falls back to those only if
	// a platform hasn't been NVS-mapped yet.
	async getPlatforms(): Promise<LookupOption[]> {
		const result = await this.pool.query(
			`SELECT p.id, COALESCE(nt.pref_label, p.name || ' ' || p.model) AS name
       FROM platforms p
       LEFT JOIN nvs_terms nt ON nt.id = p.b76_model_id
       ORDER BY name`,
		);
		return result.rows;
	}

	// The controlled list for a science sensor's asset_sensor_details.
	// l22_model_id -- the NVS "L22" device-catalogue collection.
	// `collection` isn't FK-enforced (see nvs_terms' own definition), so
	// this is the one place that convention has to be trusted directly.
	async getSensorModels(): Promise<LookupOption[]> {
		const result = await this.pool.query(
			`SELECT id, pref_label AS name FROM nvs_terms
       WHERE collection = 'L22' AND NOT deprecated
       ORDER BY name`,
		);
		return result.rows;
	}
}
