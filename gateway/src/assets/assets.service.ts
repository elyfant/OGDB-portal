import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { Asset } from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import type { SetAssetStatusDto } from "./dto/set-asset-status.dto";

// Name and model only resolve for gliders right now (via
// asset_glider_details -> platforms). Every other asset type (battery,
// ct_sensor, slocum_hull, ...) has no name/model source yet — those
// columns come back null until that type gets its own detail-table
// join added here (sensors: asset_sensor_details.l22_model_id/
// l05_family_id -> nvs_terms, now backfilled with real device models,
// just not surfaced through this API yet).
const SELECT_ASSETS = `
  SELECT
    a.id,
    agd.glider_name AS name,
    a.serial_number AS "serialNumber",
    at.name AS "assetType",
    atg.name AS "assetTypeGroup",
    TRIM(p.model) AS "assetModel",
    pm.pref_label AS "platformModelFull",
    pc.pref_label AS "platformCategory",
    a.purchase_date AS "purchaseDate",
    a.purchase_value_usd::float8 AS "purchaseValueUsd",
    aso.id AS "statusId",
    aso.name AS status,
    cas.effective_date AS "statusEffectiveDate"
  FROM assets a
  JOIN asset_types at ON at.id = a.asset_type_id
  JOIN asset_type_groups atg ON atg.id = at.group_id
  LEFT JOIN asset_glider_details agd ON agd.asset_id = a.id
  LEFT JOIN platforms p ON p.id = agd.platform_id
  LEFT JOIN nvs_terms pm ON pm.id = p.b76_model_id
  LEFT JOIN nvs_terms pc ON pc.id = p.l06_category_id
  LEFT JOIN current_asset_status cas ON cas.asset_id = a.id
  LEFT JOIN asset_status_options aso ON aso.id = cas.status_id
`;

@Injectable()
export class AssetsService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	async findAll(): Promise<Asset[]> {
		const result = await this.pool.query(
			`${SELECT_ASSETS} ORDER BY at.name, a.serial_number`,
		);
		return result.rows;
	}

	async findOne(id: number): Promise<Asset> {
		const result = await this.pool.query(`${SELECT_ASSETS} WHERE a.id = $1`, [
			id,
		]);
		if (result.rows.length === 0) {
			throw new NotFoundException(`Asset ${id} not found`);
		}
		return result.rows[0];
	}

	async setStatus(
		id: number,
		dto: SetAssetStatusDto,
		userId: number,
	): Promise<Asset> {
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
			throw err instanceof Error ? err : new Error(String(err));
		}
		return this.findOne(id);
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
