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
import type { UpdateExternalReferencesDto } from "./dto/update-external-references.dto";

const VALID_STAGES: DatasetProcessingStage[] = ["raw", "L0", "L1", "L2"];
// Matches xxxx_dataset_processing_status.py's acceptance criteria -- QC is
// only a concept for L1/L2, same as the "applicable" flag already used for
// package/version/OG1/downloads.
const QC_CAPABLE_STAGES: DatasetProcessingStage[] = ["L1", "L2"];

// One row per mission, pivoting current_dataset_processing_stage (latest
// run per stage — see xxxx_dataset_processing_status.py) into the fixed
// L0/L1/L2 columns the catalogue table shows. A mission with no
// dataset_processing row at all (nothing started yet) comes back false
// across the board via the COALESCE, not null.
const SELECT_DATASETS = `
  SELECT
    nm.id AS "missionId",
    COALESCE(nm.std_mission_name, nm.mission_name, 'Mission ' || nm.mission_number) AS "missionName",
    COALESCE(bool_or(CASE WHEN cps.stage = 'L0' THEN cps.status END), false) AS "l0Status",
    COALESCE(bool_or(CASE WHEN cps.stage = 'L1' THEN cps.status END), false) AS "l1Status",
    COALESCE(bool_or(CASE WHEN cps.stage = 'L1' THEN cps.is_og1 END), false) AS "l1Og1",
    COALESCE(bool_or(CASE WHEN cps.stage = 'L2' THEN cps.status END), false) AS "l2Status",
    COALESCE(bool_or(CASE WHEN cps.stage = 'L2' THEN cps.is_og1 END), false) AS "l2Og1"
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

const SELECT_DATASET_PROCESSING = `
  SELECT
    id,
    external_data_archive_url AS "externalDataArchiveUrl",
    ocean_ops_board_url AS "oceanOpsBoardUrl",
    coriolis_url AS "coriolisUrl"
  FROM dataset_processing
  WHERE mission_id = $1
`;

// "raw" has no package/version/QC/OG1/download concept at all — flagged
// via "applicable" so the dashboard can render "n/a" instead of a dash.
const SELECT_STAGES = `
  WITH stage_labels(stage, applicable, ord) AS (
    VALUES ('raw', false, 1), ('L0', true, 2), ('L1', true, 3), ('L2', true, 4)
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
    cps.version_id AS "versionId",
    cps.qc_removing_erroneous_data AS "qcRemoving",
    cps.qc_offset_correction AS "qcOffset",
    cps.qc_despiking_filtering AS "qcDespiking",
    qc_pkg.name AS "qcPackage",
    cps.qc_package_id AS "qcPackageId",
    qc_ver.version_url AS "qcVersionUrl",
    cps.qc_version_id AS "qcVersionId",
    cps.qc_occurred_at AS "qcOccurredAt",
    TRIM(qc_who.first_name || ' ' || qc_who.last_name) AS "qcWho",
    cps.qc_who_id AS "qcWhoId",
    cps.is_og1 AS "isOg1"
  FROM stage_labels sl
  LEFT JOIN dataset_processing dp ON dp.mission_id = $1
  LEFT JOIN current_dataset_processing_stage cps
    ON cps.dataset_processing_id = dp.id AND cps.stage = sl.stage
  LEFT JOIN contacts who ON who.id = cps.who_id
  LEFT JOIN processing_packages pkg ON pkg.id = cps.package_id
  LEFT JOIN processing_package_versions ver ON ver.id = cps.version_id
  LEFT JOIN contacts qc_who ON qc_who.id = cps.qc_who_id
  LEFT JOIN processing_packages qc_pkg ON qc_pkg.id = cps.qc_package_id
  LEFT JOIN processing_package_versions qc_ver ON qc_ver.id = cps.qc_version_id
  ORDER BY sl.ord
`;

const SELECT_HISTORY = `
  SELECT
    s.stage,
    s.status,
    s.occurred_at AS "occurredAt",
    s.created_at AS "createdAt",
    pkg.name AS package,
    TRIM(who.first_name || ' ' || who.last_name) AS who
  FROM dataset_processing_stages s
  LEFT JOIN processing_packages pkg ON pkg.id = s.package_id
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
				externalDataArchiveUrl: null,
				oceanOpsBoardUrl: null,
				coriolisUrl: null,
			}),
			stages: stages.rows.map((row) => {
				const stage = row.stage as DatasetProcessingStage;
				const key = stage.toLowerCase();
				const hasQc =
					row.qcRemoving !== null ||
					row.qcOffset !== null ||
					row.qcDespiking !== null;
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
					versionId: row.versionId,
					qc: hasQc
						? {
								removingErroneousData: row.qcRemoving,
								offsetCorrection: row.qcOffset,
								despikingFiltering: row.qcDespiking,
								package: row.qcPackage,
								packageId: row.qcPackageId,
								versionUrl: row.qcVersionUrl,
								versionId: row.qcVersionId,
								occurredAt: row.qcOccurredAt,
								who: row.qcWho,
								whoId: row.qcWhoId,
							}
						: null,
					isOg1: row.applicable ? row.isOg1 : null,
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
				dto.externalDataArchiveUrl !== undefined ||
				dto.oceanOpsBoardUrl !== undefined ||
				dto.coriolisUrl !== undefined;
			if (touchesDatasetProcessing) {
				await client.query(
					`INSERT INTO dataset_processing
             (mission_id, external_data_archive_url, ocean_ops_board_url, coriolis_url, changed_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (mission_id) DO UPDATE SET
             external_data_archive_url = COALESCE($2, dataset_processing.external_data_archive_url),
             ocean_ops_board_url = COALESCE($3, dataset_processing.ocean_ops_board_url),
             coriolis_url = COALESCE($4, dataset_processing.coriolis_url),
             changed_by = $5,
             updated_at = now()`,
					[
						missionId,
						dto.externalDataArchiveUrl ?? null,
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
		if (stage.qc && !QC_CAPABLE_STAGES.includes(stage.stage)) {
			throw new BadRequestException(`${stage.stage} has no manual QC step.`);
		}

		await this.assertVersionMatchesPackage(
			client,
			stage.versionId,
			stage.packageId,
		);
		await this.assertVersionMatchesPackage(
			client,
			stage.qc?.qcVersionId,
			stage.qc?.qcPackageId,
		);

		await client.query(
			`INSERT INTO dataset_processing_stages
         (dataset_processing_id, stage, status, who_id, occurred_at,
          package_id, version_id, qc_removing_erroneous_data,
          qc_offset_correction, qc_despiking_filtering, qc_package_id,
          qc_version_id, qc_occurred_at, qc_who_id, is_og1, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
			[
				datasetProcessingId,
				stage.stage,
				stage.status,
				stage.whoId ?? null,
				stage.occurredAt,
				stage.packageId ?? null,
				stage.versionId ?? null,
				stage.qc?.removingErroneousData ?? null,
				stage.qc?.offsetCorrection ?? null,
				stage.qc?.despikingFiltering ?? null,
				stage.qc?.qcPackageId ?? null,
				stage.qc?.qcVersionId ?? null,
				stage.qc?.qcOccurredAt ?? null,
				stage.qc?.qcWhoId ?? null,
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
