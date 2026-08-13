import { Inject, Injectable } from "@nestjs/common";
import type { DatasetProcessingStatus } from "@ogdb/types";
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

@Injectable()
export class DatasetsService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	async findAll(): Promise<DatasetProcessingStatus[]> {
		const result = await this.pool.query(SELECT_DATASETS);
		return result.rows;
	}
}
