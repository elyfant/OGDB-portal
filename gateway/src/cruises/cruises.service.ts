import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { Cruise } from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import type { CreateCruiseDto } from "./dto/create-cruise.dto";

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

function mapDbError(err: unknown): Error {
	if (
		err &&
		typeof err === "object" &&
		"code" in err &&
		(err as { code: string }).code === "23505"
	) {
		return new ConflictException("A cruise with that name already exists.");
	}
	return err instanceof Error ? err : new Error(String(err));
}

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

	async create(dto: CreateCruiseDto): Promise<Cruise> {
		try {
			const result = await this.pool.query(
				`INSERT INTO cruises
          (cruise_name, cruise_number, vessel, institute_id, cruise_leader, area, start_date, end_date, departure, destination)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
				[
					dto.cruiseName,
					dto.cruiseNumber ?? null,
					dto.vesselId ?? null,
					dto.instituteId ?? null,
					dto.cruiseLeader ?? null,
					dto.area,
					dto.startDate,
					dto.endDate,
					dto.startPort ?? null,
					dto.endPort ?? null,
				],
			);
			return this.findOne(result.rows[0].id);
		} catch (err) {
			throw mapDbError(err);
		}
	}
}
