import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	CreatedMission,
	GliderBuildComponent,
	GliderDeployment,
	Mission,
	MissionFile,
	MissionFilesSaveResult,
	MissionTrackPoint,
	MissionsLeaderboard,
	MissionsSummary,
	ScienceSensorRecord,
} from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import {
	DocumentsService,
	isLocallyStored,
	originalNameFromReference,
} from "../documents/documents.service";
import {
	applyBuildChangesTx,
	getMissionSciencePayload,
	getMissionStructuralComponents,
} from "../gliders/build.helpers";
import type { CreateMissionDto } from "./dto/create-mission.dto";
import type { SaveMissionFilesDto } from "./dto/save-mission-files.dto";
import type { UpdateMissionDto } from "./dto/update-mission.dto";
import { buildMissionName } from "./mission-name.helper";

const DAYS_EXPR =
	"ROUND(EXTRACT(EPOCH FROM (recovery_date - launch_date)) / 86400.0)";

// documents.document_type for files attached through the mission page's
// "Add key mission file" modal -- distinct from the asset/service-event
// document types so a mission-files query never picks those up.
const MISSION_KEY_FILE_DOCUMENT_TYPE = "mission_key_file";

// Raw FK ids alongside the display strings norglider_missions already
// resolves -- needed for the Add Mission dialog's "autopopulate from
// previous mission" feature, which has to set real dropdown selections,
// not just show text. Same correlated-subquery pattern already used for
// gliderAssetId/l1File/l2File below (norglider_missions doesn't
// expose these directly; missions does).
const SELECT_MISSIONS = `
  SELECT
    id,
    (SELECT glider_asset_id FROM missions WHERE missions.id = norglider_missions.id) AS "gliderAssetId",
    (SELECT l1_file FROM missions WHERE missions.id = norglider_missions.id) AS "l1File",
    (SELECT l2_file FROM missions WHERE missions.id = norglider_missions.id) AS "l2File",
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
	constructor(
		@Inject(PG_POOL) private readonly pool: Pool,
		private readonly documents: DocumentsService,
	) {}

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

	// Every mission a given asset was actually attached to a glider for --
	// the reverse of getSciencePayload/getStructuralComponents above (asset
	// -> missions instead of mission -> assets). Reads asset_assignments.
	// mission_id directly rather than inferring it from date overlap: every
	// assignment change made through GliderBuildEditor from a mission page
	// (applyBuildChangesTx in build.helpers.ts) already stamps mission_id
	// on the row, so this is exact, not a guess. The tradeoff is that it
	// only sees assignments made through the app -- the original historical
	// backfill's 88 rows never got mission_id populated (see
	// docs/design/build-hierarchy.md's "real remaining gaps"), so an asset
	// with only pre-app assignment history shows no missions here yet.
	async getForAsset(assetId: number): Promise<GliderDeployment[]> {
		const asset = await this.pool.query("SELECT 1 FROM assets WHERE id = $1", [
			assetId,
		]);
		if (asset.rows.length === 0) {
			throw new NotFoundException(`Asset ${assetId} not found`);
		}

		const result = await this.pool.query(
			`SELECT DISTINCT nm.id, nm.mission_number AS "missionNumber",
              nm.std_mission_name AS "stdMissionName", nm.status, nm.site,
              nm.launch_date AS "launchDate", nm.recovery_date AS "recoveryDate",
              nm.dives, nm.distance_km AS "distanceKm"
       FROM asset_assignments aa
       JOIN missions m ON m.id = aa.mission_id
       JOIN norglider_missions nm ON nm.id = m.id
       WHERE aa.child_asset_id = $1
       ORDER BY nm.launch_date DESC NULLS LAST`,
			[assetId],
		);
		return result.rows;
	}

	// Files attached to this mission through the "Add key mission file"
	// modal. Scoped to MISSION_KEY_FILE_DOCUMENT_TYPE so a future
	// mission-scoped document type (e.g. an auto-registered dataset
	// output) wouldn't show up here.
	async getFiles(id: number): Promise<MissionFile[]> {
		await this.findOne(id);
		const result = await this.pool.query(
			`SELECT id, file_reference, document_type, notes, created_at
       FROM documents
       WHERE mission_id = $1 AND document_type = $2
       ORDER BY created_at, id`,
			[id, MISSION_KEY_FILE_DOCUMENT_TYPE],
		);
		return result.rows.map((r) => ({
			id: r.id,
			name: originalNameFromReference(r.file_reference),
			documentType: r.document_type,
			notes: r.notes,
			createdAt: r.created_at,
			available: isLocallyStored(r.file_reference),
		}));
	}

	// One modal "save": remove the flagged documents and store the new
	// uploads, in a single transaction, then report both sides by name
	// for the success banner. Disk cleanup for removed files happens
	// after the commit -- the DB row is the source of truth, so a
	// leftover file is harmless where a deleted row with a live file is
	// not.
	async saveFiles(
		id: number,
		dto: SaveMissionFilesDto,
		userId: number,
		files: Express.Multer.File[],
	): Promise<MissionFilesSaveResult> {
		await this.findOne(id);

		const removedRefs: string[] = [];
		const deleted: string[] = [];
		const saved: string[] = [];

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");

			for (const docId of dto.deleteIds) {
				const res = await client.query(
					`DELETE FROM documents
           WHERE id = $1 AND mission_id = $2 AND document_type = $3
           RETURNING file_reference`,
					[docId, id, MISSION_KEY_FILE_DOCUMENT_TYPE],
				);
				if (res.rows.length === 0) {
					throw new NotFoundException(
						`Key file ${docId} not found for mission ${id}.`,
					);
				}
				removedRefs.push(res.rows[0].file_reference);
				deleted.push(originalNameFromReference(res.rows[0].file_reference));
			}

			for (const file of files) {
				const { fileReference, originalName } =
					await this.documents.saveUploadedFile(file);
				await this.documents.createDocumentRecord(client, {
					missionId: id,
					documentType: MISSION_KEY_FILE_DOCUMENT_TYPE,
					fileReference,
					changedBy: userId,
				});
				saved.push(originalName);
			}

			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}

		await Promise.allSettled(
			removedRefs.map((ref) => this.documents.removeFile(ref)),
		);

		return { saved, deleted };
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
           l1_file, l2_file, changed_by
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10,
           $11, $12, $13, $14,
           $15, $16, $17, $18, $19,
           $20, $21, $22, $23, $24, $25,
           $26, $27, $28
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
					dto.l1File ?? null,
					dto.l2File ?? null,
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
           iridium_minutes = $25, l1_file = $26, l2_file = $27, changed_by = $28, updated_at = now()
         WHERE id = $29
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
					dto.l1File ?? null,
					dto.l2File ?? null,
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
