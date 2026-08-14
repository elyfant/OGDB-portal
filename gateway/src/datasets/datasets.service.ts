import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	DatasetHistoryEntry,
	DatasetProcessingDetail,
	DatasetProcessingStage,
	DatasetProcessingStatus,
} from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";

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
    cps.occurred_at AS "occurredAt",
    pkg.name AS package,
    cps.version_url AS "versionUrl",
    cps.qc_removing_erroneous_data AS "qcRemoving",
    cps.qc_offset_correction AS "qcOffset",
    cps.qc_despiking_filtering AS "qcDespiking",
    qc_pkg.name AS "qcPackage",
    cps.qc_version_url AS "qcVersionUrl",
    cps.qc_occurred_at AS "qcOccurredAt",
    TRIM(qc_who.first_name || ' ' || qc_who.last_name) AS "qcWho",
    cps.is_og1 AS "isOg1"
  FROM stage_labels sl
  LEFT JOIN dataset_processing dp ON dp.mission_id = $1
  LEFT JOIN current_dataset_processing_stage cps
    ON cps.dataset_processing_id = dp.id AND cps.stage = sl.stage
  LEFT JOIN contacts who ON who.id = cps.who_id
  LEFT JOIN processing_packages pkg ON pkg.id = cps.package_id
  LEFT JOIN contacts qc_who ON qc_who.id = cps.qc_who_id
  LEFT JOIN processing_packages qc_pkg ON qc_pkg.id = cps.qc_package_id
  ORDER BY sl.ord
`;

const SELECT_HISTORY = `
  SELECT
    s.stage,
    s.status,
    s.occurred_at AS "occurredAt",
    s.created_at AS "createdAt",
    pkg.name AS package,
    s.version_url AS "versionUrl",
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
	versionUrl: string | null;
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
					occurredAt: row.occurredAt,
					package: row.package,
					versionUrl: row.versionUrl,
					qc: hasQc
						? {
								removingErroneousData: row.qcRemoving,
								offsetCorrection: row.qcOffset,
								despikingFiltering: row.qcDespiking,
								package: row.qcPackage,
								versionUrl: row.qcVersionUrl,
								occurredAt: row.qcOccurredAt,
								who: row.qcWho,
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
}
