import { Inject, Injectable } from "@nestjs/common";
import type {
	Mission,
	MissionsLeaderboard,
	MissionsSummary,
} from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";

const DAYS_EXPR =
	"ROUND(EXTRACT(EPOCH FROM (recovery_date - launch_date)) / 86400.0)";

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
        ${DAYS_EXPR}::int AS "numberOfDays"
      FROM norglider_missions
      ORDER BY launch_date DESC NULLS LAST
    `);
		return result.rows;
	}

	async getSummary(): Promise<MissionsSummary> {
		const result = await this.pool.query(`
      SELECT
        COUNT(*)::int AS "totalMissions",
        COALESCE(SUM(dives), 0)::int AS "totalDives",
        ROUND(COALESCE(SUM(distance_km), 0)::numeric)::int AS "totalDistanceKm",
        COALESCE(SUM(${DAYS_EXPR}), 0)::int AS "totalDays"
      FROM norglider_missions
    `);
		return result.rows[0];
	}

	async getLeaderboard(): Promise<MissionsLeaderboard> {
		const [byGlider, longestMission, topProject, topSite] = await Promise.all([
			this.pool.query(`
        SELECT
          glider,
          COALESCE(SUM(dives), 0)::int AS "totalDives",
          COALESCE(SUM(distance_km), 0) AS "totalDistanceKm",
          COALESCE(SUM(${DAYS_EXPR}), 0)::int AS "totalDays"
        FROM norglider_missions
        WHERE glider IS NOT NULL
        GROUP BY glider
      `),
			this.pool.query(`
        SELECT glider, std_mission_name AS "stdMissionName", ${DAYS_EXPR}::int AS days
        FROM norglider_missions
        WHERE recovery_date IS NOT NULL AND launch_date IS NOT NULL
        ORDER BY days DESC
        LIMIT 1
      `),
			this.pool.query(`
        SELECT project, COALESCE(SUM(${DAYS_EXPR}), 0)::int AS days
        FROM norglider_missions
        WHERE project IS NOT NULL
        GROUP BY project
        ORDER BY days DESC
        LIMIT 1
      `),
			this.pool.query(`
        SELECT site, COALESCE(SUM(${DAYS_EXPR}), 0)::int AS days
        FROM norglider_missions
        WHERE site IS NOT NULL
        GROUP BY site
        ORDER BY days DESC
        LIMIT 1
      `),
		]);

		const gliders = byGlider.rows as {
			glider: string;
			totalDives: number;
			totalDistanceKm: number;
			totalDays: number;
		}[];

		const maxBy = <K extends "totalDives" | "totalDistanceKm" | "totalDays">(
			key: K,
		) =>
			gliders.length === 0
				? null
				: gliders.reduce((best, row) => (row[key] > best[key] ? row : best));

		const mostDaysGlider = maxBy("totalDays");
		const mostDistanceGlider = maxBy("totalDistanceKm");
		const mostDivesGlider = maxBy("totalDives");

		return {
			mostDaysInWater: mostDaysGlider
				? { glider: mostDaysGlider.glider, days: mostDaysGlider.totalDays }
				: null,
			longestTraveller: mostDistanceGlider
				? {
						glider: mostDistanceGlider.glider,
						distanceKm: Math.round(mostDistanceGlider.totalDistanceKm),
					}
				: null,
			mostDives: mostDivesGlider
				? { glider: mostDivesGlider.glider, dives: mostDivesGlider.totalDives }
				: null,
			longestDeployment: longestMission.rows[0] ?? null,
			mostProjectDays: topProject.rows[0] ?? null,
			mostSiteDays: topSite.rows[0] ?? null,
		};
	}
}
