import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	CreatedMission,
	GliderBuildComponent,
	Mission,
	MissionTrackPoint,
	MissionsLeaderboard,
	MissionsSummary,
	ScienceSensorRecord,
} from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import {
	applyBuildChangesTx,
	getMissionSciencePayload,
	getMissionStructuralComponents,
} from "../gliders/build.helpers";
import type { CreateMissionDto } from "./dto/create-mission.dto";
import type { UpdateMissionFolderPathDto } from "./dto/update-mission-folder-path.dto";
import type { UpdateMissionDto } from "./dto/update-mission.dto";
import { buildMissionName } from "./mission-name.helper";

const DAYS_EXPR =
	"ROUND(EXTRACT(EPOCH FROM (recovery_date - launch_date)) / 86400.0)";

// Raw FK ids alongside the display strings norglider_missions already
// resolves -- needed for the Add Mission dialog's "autopopulate from
// previous mission" feature, which has to set real dropdown selections,
// not just show text. Same correlated-subquery pattern already used for
// gliderAssetId/missionFolderPath below (norglider_missions doesn't
// expose these directly; missions does).
const SELECT_MISSIONS = `
  SELECT
    id,
    (SELECT glider_asset_id FROM missions WHERE missions.id = norglider_missions.id) AS "gliderAssetId",
    (SELECT mission_folder_path FROM missions WHERE missions.id = norglider_missions.id) AS "missionFolderPath",
    (SELECT status_id FROM missions WHERE missions.id = norglider_missions.id) AS "statusId",
    (SELECT project_id FROM missions WHERE missions.id = norglider_missions.id) AS "projectId",
    (SELECT site_id FROM missions WHERE missions.id = norglider_missions.id) AS "siteId",
    (SELECT principal_investigator_id FROM missions WHERE missions.id = norglider_missions.id) AS "principalInvestigatorId",
    (SELECT technical_lead_id FROM missions WHERE missions.id = norglider_missions.id) AS "technicalLeadId",
    (SELECT operating_agency_id FROM missions WHERE missions.id = norglider_missions.id) AS "operatingAgencyId",
    (SELECT funding_agency_id FROM missions WHERE missions.id = norglider_missions.id) AS "fundingAgencyId",
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

	// Same "as of this mission's launch date" reasoning as
	// getSciencePayload above, just for the non-sensor build components.
	async getStructuralComponents(id: number): Promise<GliderBuildComponent[]> {
		const mission = await this.findOne(id);
		if (!mission.gliderAssetId || !mission.launchDate) return [];
		return getMissionStructuralComponents(
			this.pool,
			mission.gliderAssetId,
			mission.launchDate,
		);
	}

	async getTracks(id: number): Promise<MissionTrackPoint[]> {
		await this.findOne(id);
		const result = await this.pool.query(
			`SELECT latitude, longitude, utc
       FROM tracks
       WHERE missions_id = $1
       ORDER BY utc ASC`,
			[id],
		);
		return result.rows;
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

	// Creates the mission row and applies its initial glider build (if
	// any) in one transaction -- a partial save (mission created, build
	// changes lost, or vice versa) shouldn't be possible. mission_name is
	// always computed here, never taken from the client, so it can't
	// drift from the naming convention.
	async createMission(
		dto: CreateMissionDto,
		userId: number,
	): Promise<CreatedMission> {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");

			const names = await client.query(
				`SELECT
           (SELECT glider_name FROM asset_glider_details WHERE asset_id = $1) AS "gliderName",
           (SELECT name FROM projects WHERE id = $2) AS "projectName",
           (SELECT name FROM sites WHERE id = $3) AS "siteName"`,
				[dto.gliderAssetId, dto.projectId, dto.siteId],
			);
			const { gliderName, projectName, siteName } = names.rows[0];
			if (!gliderName || !projectName || !siteName) {
				throw new NotFoundException(
					"Glider, project, or site not found -- can't build a mission name.",
				);
			}
			const missionName = buildMissionName(
				gliderName,
				projectName,
				siteName,
				dto.launchDate,
			);

			const inserted = await client.query(
				`INSERT INTO missions (
           mission_number, mission_name, glider_asset_id, status_id, project_id, site_id,
           principal_investigator_id, technical_lead_id, operating_agency_id, funding_agency_id,
           launch_date, launch_latitude, launch_longitude, launch_cruise_id,
           end_date_science, recovery_date, recovery_latitude, recovery_longitude, recovery_cruise_id,
           volume, weight_in_air, density, dives, distance_km, iridium_minutes,
           mission_folder_path, changed_by
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10,
           $11, $12, $13, $14,
           $15, $16, $17, $18, $19,
           $20, $21, $22, $23, $24, $25,
           $26, $27
         ) RETURNING id, mission_number AS "missionNumber", mission_name AS "missionName"`,
				[
					dto.missionNumber,
					missionName,
					dto.gliderAssetId,
					dto.statusId,
					dto.projectId,
					dto.siteId,
					dto.principalInvestigatorId ?? null,
					dto.technicalLeadId ?? null,
					dto.operatingAgencyId ?? null,
					dto.fundingAgencyId ?? null,
					dto.launchDate,
					dto.launchLatitude ?? null,
					dto.launchLongitude ?? null,
					dto.launchCruiseId ?? null,
					dto.endDateScience ?? null,
					dto.recoveryDate ?? null,
					dto.recoveryLatitude ?? null,
					dto.recoveryLongitude ?? null,
					dto.recoveryCruiseId ?? null,
					dto.volume ?? null,
					dto.weightInAir ?? null,
					dto.density ?? null,
					dto.dives ?? null,
					dto.distanceKm ?? null,
					dto.iridiumMinutes ?? null,
					dto.missionFolderPath ?? null,
					userId,
				],
			);
			const created: CreatedMission = inserted.rows[0];

			if (dto.buildChanges && dto.buildChanges.length > 0) {
				await applyBuildChangesTx(
					client,
					dto.buildChanges,
					dto.launchDate,
					created.id,
					null,
					userId,
				);
			}

			await client.query("COMMIT");
			return created;
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}
	}

	// Same shape as createMission -- UPDATE instead of INSERT, and any
	// build changes are dated to this mission's own launch date (not
	// "today"), with mission_id pointing at the existing row rather than
	// a freshly created one. mission_name is recomputed unconditionally
	// from whatever the edit ends up submitting, same as create -- no
	// special-casing for "did glider/project/site actually change".
	async updateMission(
		id: number,
		dto: UpdateMissionDto,
		userId: number,
	): Promise<CreatedMission> {
		await this.findOne(id);
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");

			const names = await client.query(
				`SELECT
           (SELECT glider_name FROM asset_glider_details WHERE asset_id = $1) AS "gliderName",
           (SELECT name FROM projects WHERE id = $2) AS "projectName",
           (SELECT name FROM sites WHERE id = $3) AS "siteName"`,
				[dto.gliderAssetId, dto.projectId, dto.siteId],
			);
			const { gliderName, projectName, siteName } = names.rows[0];
			if (!gliderName || !projectName || !siteName) {
				throw new NotFoundException(
					"Glider, project, or site not found -- can't build a mission name.",
				);
			}
			const missionName = buildMissionName(
				gliderName,
				projectName,
				siteName,
				dto.launchDate,
			);

			const updated = await client.query(
				`UPDATE missions SET
           mission_number = $1, mission_name = $2, glider_asset_id = $3, status_id = $4,
           project_id = $5, site_id = $6,
           principal_investigator_id = $7, technical_lead_id = $8,
           operating_agency_id = $9, funding_agency_id = $10,
           launch_date = $11, launch_latitude = $12, launch_longitude = $13, launch_cruise_id = $14,
           end_date_science = $15, recovery_date = $16, recovery_latitude = $17,
           recovery_longitude = $18, recovery_cruise_id = $19,
           volume = $20, weight_in_air = $21, density = $22, dives = $23, distance_km = $24,
           iridium_minutes = $25, mission_folder_path = $26, changed_by = $27, updated_at = now()
         WHERE id = $28
         RETURNING id, mission_number AS "missionNumber", mission_name AS "missionName"`,
				[
					dto.missionNumber,
					missionName,
					dto.gliderAssetId,
					dto.statusId,
					dto.projectId,
					dto.siteId,
					dto.principalInvestigatorId ?? null,
					dto.technicalLeadId ?? null,
					dto.operatingAgencyId ?? null,
					dto.fundingAgencyId ?? null,
					dto.launchDate,
					dto.launchLatitude ?? null,
					dto.launchLongitude ?? null,
					dto.launchCruiseId ?? null,
					dto.endDateScience ?? null,
					dto.recoveryDate ?? null,
					dto.recoveryLatitude ?? null,
					dto.recoveryLongitude ?? null,
					dto.recoveryCruiseId ?? null,
					dto.volume ?? null,
					dto.weightInAir ?? null,
					dto.density ?? null,
					dto.dives ?? null,
					dto.distanceKm ?? null,
					dto.iridiumMinutes ?? null,
					dto.missionFolderPath ?? null,
					userId,
					id,
				],
			);
			const result: CreatedMission = updated.rows[0];

			if (dto.buildChanges && dto.buildChanges.length > 0) {
				await applyBuildChangesTx(
					client,
					dto.buildChanges,
					dto.launchDate,
					id,
					null,
					userId,
				);
			}

			await client.query("COMMIT");
			return result;
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}
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
		const [byGlider, longestMission, topProject, topSite, gliderIdsResult] =
			await Promise.all([
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
        SELECT id AS "missionId", glider, std_mission_name AS "stdMissionName", ${DAYS_EXPR}::int AS days
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
				// norglider_missions exposes the glider's *name*, not its
				// asset id (the view joins asset_glider_details for display
				// but doesn't select the id) -- resolved here by name instead
				// of reshaping the view, since glider_name is unique and this
				// is the only place that needs the id.
				this.pool.query(
					"SELECT asset_id AS id, glider_name AS name FROM asset_glider_details",
				),
			]);

		const gliderIds = new Map<string, number>(
			gliderIdsResult.rows.map((r: { id: number; name: string }) => [
				r.name,
				r.id,
			]),
		);

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
				? {
						glider: mostDaysGlider.glider,
						gliderAssetId: gliderIds.get(mostDaysGlider.glider) ?? null,
						days: mostDaysGlider.totalDays,
					}
				: null,
			longestTraveller: mostDistanceGlider
				? {
						glider: mostDistanceGlider.glider,
						gliderAssetId: gliderIds.get(mostDistanceGlider.glider) ?? null,
						distanceKm: Math.round(mostDistanceGlider.totalDistanceKm),
					}
				: null,
			mostDives: mostDivesGlider
				? {
						glider: mostDivesGlider.glider,
						gliderAssetId: gliderIds.get(mostDivesGlider.glider) ?? null,
						dives: mostDivesGlider.totalDives,
					}
				: null,
			longestDeployment: longestMission.rows[0] ?? null,
			mostProjectDays: topProject.rows[0] ?? null,
			mostSiteDays: topSite.rows[0] ?? null,
		};
	}
}
