import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	Mission,
	MissionsLeaderboard,
	MissionsSummary,
	ScienceSensorRecord,
} from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import { getMissionSciencePayload } from "../gliders/build.helpers";
import type { UpdateMissionFolderPathDto } from "./dto/update-mission-folder-path.dto";

const DAYS_EXPR =
	"ROUND(EXTRACT(EPOCH FROM (recovery_date - launch_date)) / 86400.0)";

const SELECT_MISSIONS = `
  SELECT
    id,
    (SELECT glider_asset_id FROM missions WHERE missions.id = norglider_missions.id) AS "gliderAssetId",
    (SELECT mission_folder_path FROM missions WHERE missions.id = norglider_missions.id) AS "missionFolderPath",
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
`;

@Injectable()
export class MissionsService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	async findAll(): Promise<Mission[]> {
		const result = await this.pool.query(
			`${SELECT_MISSIONS} ORDER BY launch_date DESC NULLS LAST`,
		);
		return result.rows;
	}

	async findOne(id: number): Promise<Mission> {
		const result = await this.pool.query(`${SELECT_MISSIONS} WHERE id = $1`, [
			id,
		]);
		if (result.rows.length === 0) {
			throw new NotFoundException(`Mission ${id} not found`);
		}
		return result.rows[0];
	}

	// Science Payload is always "as of this mission's launch date" -- a
	// mission with no glider linked, or no launch date recorded yet, has
	// nothing to resolve a build tree against.
	async getSciencePayload(id: number): Promise<ScienceSensorRecord[]> {
		const mission = await this.findOne(id);
		if (!mission.gliderAssetId || !mission.launchDate) return [];
		return getMissionSciencePayload(
			this.pool,
			mission.gliderAssetId,
			mission.launchDate,
		);
	}

	async updateFolderPath(
		id: number,
		dto: UpdateMissionFolderPathDto,
		userId: number,
	): Promise<Mission> {
		await this.findOne(id);
		await this.pool.query(
			"UPDATE missions SET mission_folder_path = $1, changed_by = $2 WHERE id = $3",
			[dto.missionFolderPath, userId, id],
		);
		return this.findOne(id);
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
