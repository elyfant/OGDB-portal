import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { Glider } from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import type { CreateGliderDto } from "./dto/create-glider.dto";
import type { SetGliderStatusDto } from "./dto/set-glider-status.dto";
import type { UpdateGliderDto } from "./dto/update-glider.dto";

const GLIDER_ASSET_TYPE_ID = 1;

const SELECT_FLEET = `
  SELECT
    a.id,
    agd.glider_name AS name,
    agd.wmo,
    p.name AS platform,
    a.serial_number AS "serialNumber",
    aso.id AS "statusId",
    aso.name AS status,
    cas.effective_date AS "statusEffectiveDate"
  FROM assets a
  JOIN asset_glider_details agd ON agd.asset_id = a.id
  LEFT JOIN platforms p ON p.id = agd.platform_id
  LEFT JOIN current_asset_status cas ON cas.asset_id = a.id
  LEFT JOIN asset_status_options aso ON aso.id = cas.status_id
  WHERE a.asset_type_id = $1
`;

@Injectable()
export class GlidersService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	async findAll(): Promise<Glider[]> {
		const result = await this.pool.query(
			`${SELECT_FLEET} ORDER BY agd.glider_name`,
			[GLIDER_ASSET_TYPE_ID],
		);
		return result.rows;
	}

	async findOne(id: number): Promise<Glider> {
		const result = await this.pool.query(`${SELECT_FLEET} AND a.id = $2`, [
			GLIDER_ASSET_TYPE_ID,
			id,
		]);
		if (result.rows.length === 0) {
			throw new NotFoundException(`Glider ${id} not found`);
		}
		return result.rows[0];
	}

	async create(dto: CreateGliderDto, userId: number): Promise<Glider> {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			const assetResult = await client.query(
				"INSERT INTO assets (asset_type_id, serial_number, changed_by) VALUES ($1, $2, $3) RETURNING id",
				[GLIDER_ASSET_TYPE_ID, dto.serialNumber ?? null, userId],
			);
			const assetId = assetResult.rows[0].id;
			await client.query(
				"INSERT INTO asset_glider_details (asset_id, glider_name, platform_id, wmo) VALUES ($1, $2, $3, $4)",
				[assetId, dto.name, dto.platformId ?? null, dto.wmo ?? null],
			);
			await client.query("COMMIT");
			return this.findOne(assetId);
		} catch (err) {
			await client.query("ROLLBACK");
			throw mapDbError(err);
		} finally {
			client.release();
		}
	}

	async update(
		id: number,
		dto: UpdateGliderDto,
		userId: number,
	): Promise<Glider> {
		await this.findOne(id);
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			if (dto.serialNumber !== undefined) {
				await client.query(
					"UPDATE assets SET serial_number = $1, updated_at = now(), changed_by = $3 WHERE id = $2",
					[dto.serialNumber, id, userId],
				);
			}
			if (
				dto.name !== undefined ||
				dto.wmo !== undefined ||
				dto.platformId !== undefined
			) {
				await client.query(
					`UPDATE asset_glider_details SET
             glider_name = COALESCE($1, glider_name),
             wmo = COALESCE($2, wmo),
             platform_id = COALESCE($3, platform_id)
           WHERE asset_id = $4`,
					[dto.name ?? null, dto.wmo ?? null, dto.platformId ?? null, id],
				);
			}
			await client.query("COMMIT");
			return this.findOne(id);
		} catch (err) {
			await client.query("ROLLBACK");
			throw mapDbError(err);
		} finally {
			client.release();
		}
	}

	async setStatus(
		id: number,
		dto: SetGliderStatusDto,
		userId: number,
	): Promise<Glider> {
		await this.findOne(id);
		try {
			await this.pool.query(
				"INSERT INTO asset_status_history (asset_id, status_id, notes, changed_by) VALUES ($1, $2, $3, $4)",
				[id, dto.statusId, dto.notes ?? null, userId],
			);
		} catch (err) {
			if (isFkViolation(err)) {
				throw new ConflictException(
					`Status option ${dto.statusId} does not exist.`,
				);
			}
			throw mapDbError(err);
		}
		return this.findOne(id);
	}

	async remove(id: number): Promise<void> {
		await this.findOne(id);
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			await client.query(
				"DELETE FROM asset_glider_details WHERE asset_id = $1",
				[id],
			);
			await client.query("DELETE FROM assets WHERE id = $1", [id]);
			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw mapDbError(err);
		} finally {
			client.release();
		}
	}
}

function isFkViolation(err: unknown): boolean {
	return (
		!!err &&
		typeof err === "object" &&
		"code" in err &&
		(err as { code: string }).code === "23503"
	);
}

function mapDbError(err: unknown): Error {
	if (isFkViolation(err)) {
		return new ConflictException(
			"This glider has related records (status history, assignments, etc.) that prevent deletion.",
		);
	}
	if (
		err &&
		typeof err === "object" &&
		"code" in err &&
		(err as { code: string }).code === "23505"
	) {
		return new ConflictException("A glider with that name already exists.");
	}
	return err instanceof Error ? err : new Error(String(err));
}
