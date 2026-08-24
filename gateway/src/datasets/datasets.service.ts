import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	DatasetHistoryEntry,
	DatasetProcessingDetail,
	DatasetProcessingStage,
	DatasetProcessingStatus,
	RecordDatasetStageInput,
} from "@ogdb/types";
import type { Pool, PoolClient } from "pg";
import { PG_POOL } from "../db/db.constants";
import type { ApplyDatasetStagesDto } from "./dto/apply-dataset-stages.dto";
import type { ConfirmErddapPushDto } from "./dto/confirm-erddap-push.dto";
import type { UpdateExternalReferencesDto } from "./dto/update-external-references.dto";

const VALID_STAGES: DatasetProcessingStage[] = ["raw", "L0", "DM", "PUB"];
// Matches xxxx_dataset_processing_dm_published.py's acceptance criteria --
// QC is only a concept for DM/PUB.
const QC_CAPABLE_STAGES: DatasetProcessingStage[] = ["DM", "PUB"];
// L0 is a raw-format conversion, not an OG1-eligible product -- only
// DM/PUB can be OG1. Matches the DB check constraint added in
// xxxx_dataset_processing_og1_check.py.
const OG1_CAPABLE_STAGES: DatasetProcessingStage[] = ["DM", "PUB"];

// One row per mission, pivoting current_dataset_processing_stage (latest
// run per stage — see xxxx_dataset_processing_dm_published.py) into the
// fixed L0/DM/PUB columns the catalogue table shows. A mission with no
// dataset_processing row at all (nothing started yet) comes back false
// across the board via the COALESCE, not null.
const SELECT_DATASETS = `
  SELECT
    nm.id AS "missionId",
    COALESCE(nm.std_mission_name, nm.mission_name, 'Mission ' || nm.mission_number) AS "missionName",
    COALESCE(bool_or(CASE WHEN cps.stage = 'L0' THEN cps.status END), false) AS "l0Status",
    COALESCE(bool_or(CASE WHEN cps.stage = 'DM' THEN cps.status END), false) AS "dmStatus",
    COALESCE(bool_or(CASE WHEN cps.stage = 'DM' THEN cps.is_og1 END), false) AS "dmOg1",
    COALESCE(bool_or(CASE WHEN cps.stage = 'PUB' THEN cps.status END), false) AS "pubStatus",
    COALESCE(bool_or(CASE WHEN cps.stage = 'PUB' THEN cps.is_og1 END), false) AS "pubOg1"
  FROM norglider_missions nm
  LEFT JOIN dataset_processing dp ON dp.mission_id = nm.id
  LEFT JOIN current_dataset_processing_stage cps ON cps.dataset_processing_id = dp.id
  GROUP BY nm.id, nm.std_mission_name, nm.mission_name, nm.mission_number, nm.launch_date
  ORDER BY nm.launch_date DESC NULLS LAST
`;

const SELECT_MISSION_HEADER = `
  SELECT
    nm.id AS "missionId",
    nm.mission_number AS "missionNumber",
    COALESCE(nm.std_mission_name, nm.mission_name, 'Mission ' || nm.mission_number) AS "missionName",
    nm.status,
    nm.glider,
    nm.site,
    nm.launch_date AS "launchDate",
    nm.recovery_date AS "recoveryDate",
    m.doi
  FROM norglider_missions nm
  JOIN missions m ON m.id = nm.id
  WHERE nm.id = $1
`;

// current_erddap_status (see xxxx_erddap_pushes.py) holds the latest
// confirmed push per (dataset_processing_id, level) -- joined in twice,
// once per level, and defaulted to "none" for a mission with no
// confirmations yet.
const SELECT_DATASET_PROCESSING = `
  SELECT
    dp.id,
    dp.erddap_l1_url AS "erddapL1Url",
    COALESCE(l1.status, 'none') AS "erddapL1Status",
    dp.erddap_l2_url AS "erddapL2Url",
    COALESCE(l2.status, 'none') AS "erddapL2Status",
    dp.ocean_ops_board_url AS "oceanOpsBoardUrl",
    dp.coriolis_url AS "coriolisUrl"
  FROM dataset_processing dp
  LEFT JOIN current_erddap_status l1
    ON l1.dataset_processing_id = dp.id AND l1.level = 'L1'
  LEFT JOIN current_erddap_status l2
    ON l2.dataset_processing_id = dp.id AND l2.level = 'L2'
  WHERE dp.mission_id = $1
`;

// "raw" has no package/version/QC/OG1/download concept at all — flagged
// via "applicable" so the dashboard can render "n/a" instead of a dash.
const SELECT_STAGES = `
  WITH stage_labels(stage, applicable, ord) AS (
    VALUES ('raw', false, 1), ('L0', true, 2), ('DM', true, 3), ('PUB', true, 4)
  )
  SELECT
    sl.stage,
    sl.applicable,
    COALESCE(cps.status, false) AS status,
    TRIM(who.first_name || ' ' || who.last_name) AS who,
    cps.who_id AS "whoId",
    cps.occurred_at AS "occurredAt",
    pkg.name AS package,
    cps.package_id AS "packageId",
    ver.version_url AS "versionUrl",
    ver.version_label AS "versionLabel",
    cps.version_id AS "versionId",
    cps.processing_notes AS "processingNotes",
    cps.qc_done AS "qcDone",
    cps.is_og1 AS "isOg1"
  FROM stage_labels sl
  LEFT JOIN dataset_processing dp ON dp.mission_id = $1
  LEFT JOIN current_dataset_processing_stage cps
    ON cps.dataset_processing_id = dp.id AND cps.stage = sl.stage
  LEFT JOIN contacts who ON who.id = cps.who_id
  LEFT JOIN processing_packages pkg ON pkg.id = cps.package_id
  LEFT JOIN processing_package_versions ver ON ver.id = cps.version_id
  ORDER BY sl.ord
`;

// dataset_processing_stages is append-only, so each row is a full
// snapshot at that point, not a diff -- version/OG1/QC/processing_notes
// are pulled here too so the dashboard can show them on demand per
// history entry, not just the one-line description.
const SELECT_HISTORY = `
  SELECT
    s.stage,
    s.status,
    s.occurred_at AS "occurredAt",
    s.created_at AS "createdAt",
    pkg.name AS package,
    TRIM(who.first_name || ' ' || who.last_name) AS who,
    ver.version_label AS "versionLabel",
    s.is_og1 AS "isOg1",
    s.qc_done AS "qcDone",
    s.processing_notes AS "processingNotes"
  FROM dataset_processing_stages s
  LEFT JOIN processing_packages pkg ON pkg.id = s.package_id
  LEFT JOIN processing_package_versions ver ON ver.id = s.version_id
  LEFT JOIN contacts who ON who.id = s.who_id
  WHERE s.dataset_processing_id = (SELECT id FROM dataset_processing WHERE mission_id = $1)
  ORDER BY s.created_at DESC
  LIMIT 10
`;

function describeHistoryEntry(row: {
	stage: string;
	status: boolean;
	package: string | null;
	who: string | null;
}): string {
	const label = row.status ? "marked done" : "marked not done";
	const via = row.package ? ` via ${row.package}` : "";
	const by = row.who ? ` by ${row.who}` : "";
	return `${row.stage} ${label}${via}${by}`;
}

@Injectable()
export class DatasetsService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	async findAll(): Promise<DatasetProcessingStatus[]> {
		const result = await this.pool.query(SELECT_DATASETS);
		return result.rows;
	}

	async findDetail(missionId: number): Promise<DatasetProcessingDetail> {
		const [header, processing, stages, documents, history] = await Promise.all([
			this.pool.query(SELECT_MISSION_HEADER, [missionId]),
			this.pool.query(SELECT_DATASET_PROCESSING, [missionId]),
			this.pool.query(SELECT_STAGES, [missionId]),
			this.pool.query(
				'SELECT document_type AS "documentType" FROM documents WHERE mission_id = $1',
				[missionId],
			),
			this.pool.query(SELECT_HISTORY, [missionId]),
		]);

		if (header.rows.length === 0) {
			throw new NotFoundException(`Mission ${missionId} not found`);
		}

		const documentTypes = new Set(
			documents.rows.map((row) => row.documentType as string),
		);

		return {
			...header.rows[0],
			...(processing.rows[0] ?? {
				erddapL1Url: null,
				erddapL1Status: "none",
				erddapL2Url: null,
				erddapL2Status: "none",
				oceanOpsBoardUrl: null,
				coriolisUrl: null,
			}),
			stages: stages.rows.map((row) => {
				const stage = row.stage as DatasetProcessingStage;
				// document_type convention: "<stage lowercased>_output" /
				// "_og1" -- "dm_output"/"pub_output" etc. under the new codes.
				const key = stage.toLowerCase();
				return {
					stage,
					applicable: row.applicable,
					status: row.status,
					who: row.who,
					whoId: row.whoId,
					occurredAt: row.occurredAt,
					package: row.package,
					packageId: row.packageId,
					versionUrl: row.versionUrl,
					versionLabel: row.versionLabel,
					versionId: row.versionId,
					processingNotes: row.processingNotes,
					qcDone: row.qcDone,
					isOg1: OG1_CAPABLE_STAGES.includes(stage) ? row.isOg1 : null,
					hasInternalDownload:
						row.applicable && documentTypes.has(`${key}_output`),
					hasInternalDownloadOg1:
						row.applicable && documentTypes.has(`${key}_og1`),
				};
			}),
			history: history.rows.map(
				(row): DatasetHistoryEntry => ({
					occurredAt: row.createdAt,
					description: describeHistoryEntry(row),
					versionLabel: row.versionLabel,
					isOg1: row.isOg1,
					qcDone: row.qcDone,
					processingNotes: row.processingNotes,
				}),
			),
		};
	}

	// dataset_processing_stages is append-only (see xxxx_dataset_processing_
	// status.py) -- recording a stage is always an INSERT, never an UPDATE,
	// so a reprocessing run doesn't erase the previous one. Every stage in
	// one request lands in a single transaction, same reasoning as the
	// glider build editor's ApplyBuildChangesDto.
	async applyStages(
		missionId: number,
		dto: ApplyDatasetStagesDto,
		userId: number,
	): Promise<DatasetProcessingDetail> {
		await this.assertMissionExists(missionId);

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");

			const datasetProcessingId = await this.findOrCreateDatasetProcessing(
				client,
				missionId,
				userId,
			);

			for (const stage of dto.stages) {
				await this.insertStageRecord(
					client,
					datasetProcessingId,
					stage,
					userId,
				);
			}

			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}

		return this.findDetail(missionId);
	}

	async updateExternalReferences(
		missionId: number,
		dto: UpdateExternalReferencesDto,
		userId: number,
	): Promise<DatasetProcessingDetail> {
		await this.assertMissionExists(missionId);

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");

			if (dto.doi !== undefined) {
				await client.query(
					"UPDATE missions SET doi = $1, changed_by = $2 WHERE id = $3",
					[dto.doi, userId, missionId],
				);
			}

			const touchesDatasetProcessing =
				dto.erddapL1Url !== undefined ||
				dto.erddapL2Url !== undefined ||
				dto.oceanOpsBoardUrl !== undefined ||
				dto.coriolisUrl !== undefined;
			if (touchesDatasetProcessing) {
				await client.query(
					`INSERT INTO dataset_processing
           (mission_id, erddap_l1_url, erddap_l2_url, ocean_ops_board_url, coriolis_url, changed_by)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (mission_id) DO UPDATE SET
             erddap_l1_url = COALESCE($2, dataset_processing.erddap_l1_url),
             erddap_l2_url = COALESCE($3, dataset_processing.erddap_l2_url),
             ocean_ops_board_url = COALESCE($4, dataset_processing.ocean_ops_board_url),
             coriolis_url = COALESCE($5, dataset_processing.coriolis_url),
             changed_by = $6,
             updated_at = now()`,
					[
						missionId,
						dto.erddapL1Url ?? null,
						dto.erddapL2Url ?? null,
						dto.oceanOpsBoardUrl ?? null,
						dto.coriolisUrl ?? null,
						userId,
					],
				);
			}

			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}

		return this.findDetail(missionId);
	}

	// erddap_pushes is append-only (see xxxx_erddap_pushes.py) -- confirming
	// a status is always an INSERT. Confirming "PUB" for a level
	// automatically supersedes a prior "DM" confirmation for that same
	// level, just by virtue of current_erddap_status picking the latest
	// row -- no separate "clear the other flag" step needed.
	async confirmErddapPush(
		missionId: number,
		dto: ConfirmErddapPushDto,
		userId: number,
	): Promise<DatasetProcessingDetail> {
		await this.assertMissionExists(missionId);

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");

			const datasetProcessingId = await this.findOrCreateDatasetProcessing(
				client,
				missionId,
				userId,
			);
			await client.query(
				`INSERT INTO erddap_pushes (dataset_processing_id, level, status, changed_by)
         VALUES ($1, $2, $3, $4)`,
				[datasetProcessingId, dto.level, dto.status, userId],
			);

			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}

		return this.findDetail(missionId);
	}

	private async assertMissionExists(missionId: number): Promise<void> {
		const result = await this.pool.query(
			"SELECT id FROM missions WHERE id = $1",
			[missionId],
		);
		if (result.rows.length === 0) {
			throw new NotFoundException(`Mission ${missionId} not found`);
		}
	}

	private async findOrCreateDatasetProcessing(
		client: PoolClient,
		missionId: number,
		userId: number,
	): Promise<number> {
		const result = await client.query(
			`INSERT INTO dataset_processing (mission_id, changed_by)
       VALUES ($1, $2)
       ON CONFLICT (mission_id) DO UPDATE SET updated_at = now()
       RETURNING id`,
			[missionId, userId],
		);
		return result.rows[0].id;
	}

	private async insertStageRecord(
		client: PoolClient,
		datasetProcessingId: number,
		stage: RecordDatasetStageInput,
		userId: number,
	): Promise<void> {
		if (!VALID_STAGES.includes(stage.stage)) {
			throw new BadRequestException(`Unknown stage: ${stage.stage}`);
		}
		if (!stage.occurredAt) {
			throw new BadRequestException(`${stage.stage}: occurredAt is required.`);
		}
		if (
			stage.qcDone != null &&
			!QC_CAPABLE_STAGES.includes(stage.stage)
		) {
			throw new BadRequestException(`${stage.stage} has no manual QC step.`);
		}
		if (stage.processingNotes && !QC_CAPABLE_STAGES.includes(stage.stage)) {
			throw new BadRequestException(
				`${stage.stage} has no processing notes field.`,
			);
		}
		if (
			stage.isOg1 != null &&
			!OG1_CAPABLE_STAGES.includes(stage.stage)
		) {
			throw new BadRequestException(`${stage.stage} has no OG1 concept.`);
		}
		if ((stage.processingNotes?.length ?? 0) > 5000) {
			throw new BadRequestException(
				`${stage.stage}: processing notes can't exceed 5000 characters.`,
			);
		}

		await this.assertVersionMatchesPackage(
			client,
			stage.versionId,
			stage.packageId,
		);

		await client.query(
			`INSERT INTO dataset_processing_stages
         (dataset_processing_id, stage, status, who_id, occurred_at,
          package_id, version_id, processing_notes, qc_done, is_og1, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
			[
				datasetProcessingId,
				stage.stage,
				stage.status,
				stage.whoId ?? null,
				stage.occurredAt,
				stage.packageId ?? null,
				stage.versionId ?? null,
				stage.processingNotes ?? null,
				stage.qcDone ?? null,
				stage.isOg1 ?? null,
				userId,
			],
		);
	}

	// Not a DB constraint (version_id and package_id are independent FKs --
	// see xxxx_processing_package_versions.py) so a version submitted under
	// the wrong package has to be caught here.
	private async assertVersionMatchesPackage(
		client: PoolClient,
		versionId: number | null | undefined,
		packageId: number | null | undefined,
	): Promise<void> {
		if (!versionId) return;
		if (!packageId) {
			throw new BadRequestException(
				"A version was selected without its package.",
			);
		}
		const result = await client.query(
			'SELECT package_id AS "packageId" FROM processing_package_versions WHERE id = $1',
			[versionId],
		);
		if (result.rows.length === 0) {
			throw new NotFoundException(
				`Processing package version ${versionId} not found`,
			);
		}
		if (result.rows[0].packageId !== packageId) {
			throw new ConflictException(
				`Version ${versionId} does not belong to package ${packageId}.`,
			);
		}
	}
}
