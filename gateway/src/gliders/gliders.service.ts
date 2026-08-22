import {
	ConflictException,
	HttpException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { Glider, GliderBuild } from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import { applyBuildChangesTx, getGliderBuild } from "./build.helpers";
import type { ApplyBuildChangesDto } from "./dto/apply-build-changes.dto";
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
    NULLIF(TRIM(p.model), '') AS "platformModel",
    pm.pref_label AS "platformModelFull",
    pm.uri AS "platformModelUri",
    pc.pref_label AS "platformCategory",
    pc.definition AS "platformCategoryDefinition",
    pc.uri AS "platformCategoryUri",
    a.serial_number AS "serialNumber",
    i.name AS owner,
    m.name AS manufacturer,
    m."NVS_L35_preferred_label" AS "manufacturerL35Name",
    m."NVS_L35_definition" AS "manufacturerL35Definition",
    pmfr."NVS_L35_preferred_label" AS "platformManufacturerName",
    pmfr."NVS_L35_url" AS "platformManufacturerUri",
    a.purchase_date AS "purchaseDate",
    a.purchase_value_usd::float8 AS "purchaseValueUsd",
    aso.id AS "statusId",
    aso.name AS status,
    cas.effective_date AS "statusEffectiveDate",
    agd.platform_id AS "platformId",
    a.institute_id AS "instituteId"
  FROM assets a
  JOIN asset_glider_details agd ON agd.asset_id = a.id
  LEFT JOIN platforms p ON p.id = agd.platform_id
  LEFT JOIN nvs_terms pm ON pm.id = p.b76_model_id
  LEFT JOIN nvs_terms pc ON pc.id = p.l06_category_id
  LEFT JOIN institutes i ON i.id = a.institute_id
  LEFT JOIN manufacturers_with_nvs m ON m.id = a.manufacturer_id
  LEFT JOIN manufacturers_with_nvs pmfr ON pmfr.id = p.manufacturer_id
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

	async getBuild(id: number): Promise<GliderBuild> {
		await this.findOne(id);
		return getGliderBuild(this.pool, id);
	}

	async create(dto: CreateGliderDto, userId: number): Promise<Glider> {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			const assetResult = await client.query(
				`INSERT INTO assets (asset_type_id, serial_number, institute_id, purchase_date, purchase_value_usd, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
				[
					GLIDER_ASSET_TYPE_ID,
					dto.serialNumber ?? null,
					dto.instituteId ?? null,
					dto.purchaseDate ?? null,
					dto.purchaseValueUsd ?? null,
					userId,
				],
			);
			const assetId = assetResult.rows[0].id;
			await client.query(
				"INSERT INTO asset_glider_details (asset_id, glider_name, platform_id, wmo) VALUES ($1, $2, $3, $4)",
				[assetId, dto.name, dto.platformId ?? null, dto.wmo ?? null],
			);
			// New gear sits in the lab before it's deployed -- same default
			// AssetsService.create uses for every other asset type.
			await client.query(
				`INSERT INTO asset_status_history (asset_id, status_id, changed_by)
         SELECT $1, id, $2 FROM asset_status_options WHERE name = 'lab'`,
				[assetId, userId],
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
			if (
				dto.serialNumber !== undefined ||
				dto.instituteId !== undefined ||
				dto.purchaseDate !== undefined ||
				dto.purchaseValueUsd !== undefined
			) {
				await client.query(
					`UPDATE assets SET
             serial_number = COALESCE($1, serial_number),
             institute_id = COALESCE($2, institute_id),
             purchase_date = COALESCE($3, purchase_date),
             purchase_value_usd = COALESCE($4, purchase_value_usd),
             updated_at = now(),
             changed_by = $6
           WHERE id = $5`,
					[
						dto.serialNumber ?? null,
						dto.instituteId ?? null,
						dto.purchaseDate ?? null,
						dto.purchaseValueUsd ?? null,
						id,
						userId,
					],
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

	// Applies a batch of build changes as one transaction -- a "replace" is
	// logically one action (close old, open new), not two independent API
	// calls, so a failure partway through can't leave the build half-swapped.
	async applyBuildChanges(
		gliderAssetId: number,
		dto: ApplyBuildChangesDto,
		userId: number,
	): Promise<GliderBuild> {
		await this.findOne(gliderAssetId);

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			await applyBuildChangesTx(
				client,
				dto.changes,
				dto.effectiveDate,
				dto.missionId ?? null,
				dto.notes,
				userId,
			);
			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err instanceof HttpException ? err : mapDbError(err);
		} finally {
			client.release();
		}

		return getGliderBuild(this.pool, gliderAssetId);
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
