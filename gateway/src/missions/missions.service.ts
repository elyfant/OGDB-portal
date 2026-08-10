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
        id,
        mission_number AS "missionNumber",
        mission_name AS "missionName",
        std_mission_name AS "stdMissionName",
        status,
        project,
        glider,
        platform,
        site,
        pi,
        tech,
        operating_agency AS "operatingAgency",
        funding_agency AS "fundingAgency",
        launch_cruise_id AS "launchCruiseId",
        recovery_cruise_id AS "recoveryCruiseId",
        volume,
        weight_in_air AS "weightInAir",
        density,
        iridium_minutes AS "iridiumMinutes",
        launch_date AS "launchDate",
        launch_latitude AS "launchLatitude",
        launch_longitude AS "launchLongitude",
        end_date_science AS "endDateScience",
        recovery_date AS "recoveryDate",
        recovery_latitude AS "recoveryLatitude",
        recovery_longitude AS "recoveryLongitude",
        dives,
        distance_km AS "distanceKm",
        ROUND(EXTRACT(EPOCH FROM (recovery_date - launch_date)) / 86400.0)::int AS "numberOfDays"
      FROM norglider_missions
      ORDER BY launch_date DESC NULLS LAST
    `);
		return result.rows;
	}
}
