import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { Asset, AssetSearchResult } from "@ogdb/types";
import type { Pool } from "pg";
import {
	CAL_COLUMNS,
	CAL_TABLES,
	FLAT_MODEL_TABLES,
} from "../common/asset-tables";
import { PG_POOL } from "../db/db.constants";
import type { RecordSensorCalibrationDto } from "./dto/record-sensor-calibration.dto";
import type { SetAssetStatusDto } from "./dto/set-asset-status.dto";

// Mirrors the classification in gliders/build.helpers.ts's fetchModels,
// scoped to one type + a serial-number search instead of batching many
// assets at once — used by the build editor's "search by serial number"
// dropdown, so each option can show its model alongside the serial.
const SENSOR_TYPES = new Set([
	"ct_sensor",
	"do_sensor",
	"eco_sensor",
	"mr_sensor",
]);

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

	async search(assetType: string, query: string): Promise<AssetSearchResult[]> {
		const like = `%${query}%`;

		if (SENSOR_TYPES.has(assetType)) {
			const result = await this.pool.query(
				`SELECT a.id, a.serial_number AS "serialNumber", t.pref_label AS model
         FROM assets a
         JOIN asset_types at ON at.id = a.asset_type_id AND at.name = $1
         LEFT JOIN asset_sensor_details asd ON asd.asset_id = a.id
         LEFT JOIN nvs_terms t ON t.id = asd.l22_model_id
         WHERE a.serial_number ILIKE $2
         ORDER BY a.serial_number
         LIMIT 25`,
				[assetType, like],
			);
			return result.rows;
		}

		if (assetType === "battery") {
			const result = await this.pool.query(
				`SELECT a.id, a.serial_number AS "serialNumber", bm.model
         FROM assets a
         JOIN asset_types at ON at.id = a.asset_type_id AND at.name = $1
         LEFT JOIN asset_battery_details abd ON abd.asset_id = a.id
         LEFT JOIN battery_models bm ON bm.id = abd.battery_model_id
         WHERE a.serial_number ILIKE $2
         ORDER BY a.serial_number
         LIMIT 25`,
				[assetType, like],
			);
			return result.rows;
		}

		if (assetType === "slocum_hull") {
			const result = await this.pool.query(
				`SELECT a.id, a.serial_number AS "serialNumber", hm.teledyne_part_number AS model
         FROM assets a
         JOIN asset_types at ON at.id = a.asset_type_id AND at.name = $1
         LEFT JOIN asset_slocum_hull_details hd ON hd.asset_id = a.id
         LEFT JOIN hull_models hm ON hm.id = hd.hull_model_id
         WHERE a.serial_number ILIKE $2
         ORDER BY a.serial_number
         LIMIT 25`,
				[assetType, like],
			);
			return result.rows;
		}

		const flatTable = FLAT_MODEL_TABLES[assetType];
		if (flatTable) {
			const result = await this.pool.query(
				`SELECT a.id, a.serial_number AS "serialNumber", d.model
         FROM assets a
         JOIN asset_types at ON at.id = a.asset_type_id AND at.name = $1
         LEFT JOIN ${flatTable} d ON d.asset_id = a.id
         WHERE a.serial_number ILIKE $2
         ORDER BY a.serial_number
         LIMIT 25`,
				[assetType, like],
			);
			return result.rows;
		}

		const result = await this.pool.query(
			`SELECT a.id, a.serial_number AS "serialNumber", NULL::text AS model
       FROM assets a
       JOIN asset_types at ON at.id = a.asset_type_id AND at.name = $1
       WHERE a.serial_number ILIKE $2
       ORDER BY a.serial_number
       LIMIT 25`,
			[assetType, like],
		);
		return result.rows;
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

	// Always an INSERT -- the cal tables are append-only (same "current =
	// latest by date" pattern as asset_status_history and everywhere else),
	// so recording a calibration never overwrites a previous one, even an
	// older-dated one entered after the fact.
	async recordCalibration(
		id: number,
		dto: RecordSensorCalibrationDto,
		userId: number,
	): Promise<void> {
		const asset = await this.pool.query(
			`SELECT at.name AS "assetType" FROM assets a
       JOIN asset_types at ON at.id = a.asset_type_id
       WHERE a.id = $1`,
			[id],
		);
		if (asset.rows.length === 0) {
			throw new NotFoundException(`Asset ${id} not found`);
		}
		const assetType = asset.rows[0].assetType as string;

		const calInfo = CAL_TABLES[assetType];
		if (!calInfo) {
			throw new BadRequestException(`${assetType} has no calibration table.`);
		}
		const [table, dateColumn] = calInfo;
		const allowedColumns = new Set(CAL_COLUMNS[assetType] ?? []);

		const keys = Object.keys(dto.coefficients);
		const unknown = keys.filter((k) => !allowedColumns.has(k));
		if (unknown.length > 0) {
			throw new BadRequestException(
				`Unknown calibration field(s) for ${assetType}: ${unknown.join(", ")}`,
			);
		}

		const columns = [dateColumn, ...keys, "changed_by"];
		const values = [
			dto.calDate,
			...keys.map((k) => dto.coefficients[k]),
			userId,
		];
		const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

		await this.pool.query(
			`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
			values,
		);
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
