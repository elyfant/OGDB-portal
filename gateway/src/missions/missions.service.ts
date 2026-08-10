import { Inject, Injectable } from "@nestjs/common";
import type { Mission } from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";

@Injectable()
export class MissionsService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	async findAll(): Promise<Mission[]> {
		const result = await this.pool.query(`
      SELECT
        mission_number AS "missionNumber",
        std_mission_name AS "stdMissionName",
        status,
        glider,
        project,
        site,
        pi,
        platform,
        funding_agency AS "fundingAgency",
        launch_date AS "launchDate",
        recovery_date AS "recoveryDate",
        dives,
        distance_km AS "distanceKm",
        ROUND(EXTRACT(EPOCH FROM (recovery_date - launch_date)) / 86400.0)::int AS "numberOfDays"
      FROM norglider_missions
      ORDER BY launch_date DESC NULLS LAST
    `);
		return result.rows;
	}
}
