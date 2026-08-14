import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Cruise } from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";

const SELECT_CRUISES = `
  SELECT
    c.id,
    c.cruise_name AS "cruiseName",
    c.cruise_number AS "cruiseNumber",
    v.name AS vessel,
    v.url AS "vesselUrl",
    i.name AS institute,
    c.cruise_leader AS "cruiseLeader",
    c.area,
    c.start_date AS "startDate",
    c.end_date AS "endDate",
    c.departure AS "startPort",
    c.destination AS "endPort"
  FROM cruises c
  LEFT JOIN vessels v ON v.id = c.vessel
  LEFT JOIN institutes i ON i.id = c.institute_id
`;

@Injectable()
export class CruisesService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	async findAll(): Promise<Cruise[]> {
		const result = await this.pool.query(
			`${SELECT_CRUISES} ORDER BY c.start_date DESC NULLS LAST`,
		);
		return result.rows;
	}

	async findOne(id: number): Promise<Cruise> {
		const result = await this.pool.query(`${SELECT_CRUISES} WHERE c.id = $1`, [
			id,
		]);
		if (result.rows.length === 0) {
			throw new NotFoundException(`Cruise ${id} not found`);
		}
		return result.rows[0];
	}
}
