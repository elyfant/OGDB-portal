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
import { DocumentsService } from "../documents/documents.service";
import type { CreateAssetDto } from "./dto/create-asset.dto";
import type { RecordSensorCalibrationDto } from "./dto/record-sensor-calibration.dto";
import type { SetAssetStatusDto } from "./dto/set-asset-status.dto";
import type { UpdateAssetDto } from "./dto/update-asset.dto";

// The one calibration-related asset_service_event_types row -- used to
// give every calibration insert a matching service event, so a
// certificate has something to attach to via documents.service_event_id.
const CALIBRATION_EVENT_TYPE = "calibration";

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
	constructor(
		@Inject(PG_POOL) private readonly pool: Pool,
		private readonly documents: DocumentsService,
	) {}

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

	// Generic fields only -- gliders go through GlidersService.create
	// instead, since that's the one asset type with its own detail table
	// (asset_glider_details) this app knows how to populate. Creating a
	// "glider" here would leave that table empty and produce a broken
	// row (no name, no platform) that GlidersTable/detail pages assume
	// always exists.
	async create(dto: CreateAssetDto, userId: number): Promise<Asset> {
		const typeResult = await this.pool.query(
			"SELECT name FROM asset_types WHERE id = $1",
			[dto.assetTypeId],
		);
		if (typeResult.rows.length === 0) {
			throw new BadRequestException(
				`Asset type ${dto.assetTypeId} does not exist.`,
			);
		}
		if (typeResult.rows[0].name === "glider") {
			throw new BadRequestException(
				"Gliders are created from the Fleet page, not here.",
			);
		}

		const result = await this.pool.query(
			`INSERT INTO assets (asset_type_id, serial_number, notes, purchase_date, purchase_value_usd, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
			[
				dto.assetTypeId,
				dto.serialNumber ?? null,
				dto.notes ?? null,
				dto.purchaseDate ?? null,
				dto.purchaseValueUsd ?? null,
				userId,
			],
		);
		const assetId = result.rows[0].id;

		// New gear sits in the lab before it's deployed -- give every
		// asset a real starting status rather than leaving it unset (the
		// same asset_status_history insert setStatus() uses).
		await this.pool.query(
			`INSERT INTO asset_status_history (asset_id, status_id, changed_by)
       SELECT $1, id, $2 FROM asset_status_options WHERE name = 'lab'`,
			[assetId, userId],
		);

		return this.findOne(assetId);
	}

	// COALESCE-based partial update -- same convention as
	// GlidersService.update: an omitted field keeps its current value
	// rather than getting cleared, so there's no way to blank out
	// serialNumber/notes/etc through this form (matches the create
	// form's own "generic fields only" scope -- assetTypeId is
	// deliberately never referenced here, see UpdateAssetDto).
	async update(
		id: number,
		dto: UpdateAssetDto,
		userId: number,
	): Promise<Asset> {
		await this.findOne(id);
		if (
			dto.serialNumber !== undefined ||
			dto.notes !== undefined ||
			dto.purchaseDate !== undefined ||
			dto.purchaseValueUsd !== undefined
		) {
			await this.pool.query(
				`UPDATE assets SET
           serial_number = COALESCE($1, serial_number),
           notes = COALESCE($2, notes),
           purchase_date = COALESCE($3, purchase_date),
           purchase_value_usd = COALESCE($4, purchase_value_usd),
           updated_at = now(),
           changed_by = $6
         WHERE id = $5`,
				[
					dto.serialNumber ?? null,
					dto.notes ?? null,
					dto.purchaseDate ?? null,
					dto.purchaseValueUsd ?? null,
					id,
					userId,
				],
			);
		}
		return this.findOne(id);
	}

	// Always an INSERT -- the cal tables are append-only (same "current =
	// latest by date" pattern as asset_status_history and everywhere else),
	// so recording a calibration never overwrites a previous one, even an
	// older-dated one entered after the fact.
	//
	// When a certificate file is attached, the whole thing -- cal row,
	// asset_service_events row, saved file, documents row -- happens in
	// one transaction. Only ct_sensor's cal table has the
	// service_event_id column a certificate needs to attach to; other
	// asset types can still record coefficients, just not a certificate
	// yet.
	async recordCalibration(
		id: number,
		dto: RecordSensorCalibrationDto,
		userId: number,
		certificate?: Express.Multer.File,
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

		if (certificate && table !== "asset_ct_sensor_cal") {
			throw new BadRequestException(
				`Certificates aren't supported for ${assetType} yet.`,
			);
		}

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");

			let serviceEventId: number | null = null;
			if (certificate) {
				const eventType = await client.query(
					"SELECT id FROM asset_service_event_types WHERE name = $1",
					[CALIBRATION_EVENT_TYPE],
				);
				const eventInsert = await client.query(
					`INSERT INTO asset_service_events (asset_id, event_type_id, event_date, changed_by)
           VALUES ($1, $2, $3, $4) RETURNING id`,
					[id, eventType.rows[0].id, dto.calDate, userId],
				);
				serviceEventId = eventInsert.rows[0].id;
			}

			const columns = [
				"asset_id",
				dateColumn,
				...keys,
				"changed_by",
				...(serviceEventId ? ["service_event_id"] : []),
			];
			const values = [
				id,
				dto.calDate,
				...keys.map((k) => dto.coefficients[k]),
				userId,
				...(serviceEventId ? [serviceEventId] : []),
			];
			const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

			await client.query(
				`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
				values,
			);

			if (certificate && serviceEventId) {
				const { fileReference } =
					await this.documents.saveUploadedFile(certificate);
				await this.documents.createDocumentRecord(client, {
					assetId: id,
					serviceEventId,
					documentType: "certificate",
					fileReference,
					changedBy: userId,
				});
			}

			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}
	}

	// Unlike recordCalibration, this is a real UPDATE in place -- not
	// another append. The cal tables are append-only for recording a new
	// calibration *event*, but this endpoint isn't that: it's correcting
	// or completing the record of one already-recorded event (a typo, a
	// coefficient missed the first time, attaching a certificate after
	// the fact), which is a different thing from "the sensor was
	// recalibrated again." A full-replace PATCH (every known coefficient
	// column gets set, not just the ones present in the request) so that
	// clearing a field in the edit form actually clears it in the DB,
	// same convention as MissionsService.updateMission.
	async updateCalibration(
		assetId: number,
		calId: number,
		dto: RecordSensorCalibrationDto,
		userId: number,
		certificate?: Express.Multer.File,
	): Promise<void> {
		const asset = await this.pool.query(
			`SELECT at.name AS "assetType" FROM assets a
       JOIN asset_types at ON at.id = a.asset_type_id
       WHERE a.id = $1`,
			[assetId],
		);
		if (asset.rows.length === 0) {
			throw new NotFoundException(`Asset ${assetId} not found`);
		}
		const assetType = asset.rows[0].assetType as string;

		const calInfo = CAL_TABLES[assetType];
		if (!calInfo) {
			throw new BadRequestException(`${assetType} has no calibration table.`);
		}
		const [table, dateColumn] = calInfo;
		const allColumns = CAL_COLUMNS[assetType] ?? [];
		const allowedColumns = new Set(allColumns);

		const unknown = Object.keys(dto.coefficients).filter(
			(k) => !allowedColumns.has(k),
		);
		if (unknown.length > 0) {
			throw new BadRequestException(
				`Unknown calibration field(s) for ${assetType}: ${unknown.join(", ")}`,
			);
		}

		const hasServiceEventColumn = table === "asset_ct_sensor_cal";
		if (certificate && !hasServiceEventColumn) {
			throw new BadRequestException(
				`Certificates aren't supported for ${assetType} yet.`,
			);
		}

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");

			const existing = await client.query(
				`SELECT asset_id${hasServiceEventColumn ? ", service_event_id" : ""}
         FROM ${table} WHERE id = $1 FOR UPDATE`,
				[calId],
			);
			if (existing.rows.length === 0 || existing.rows[0].asset_id !== assetId) {
				throw new NotFoundException(
					`Calibration ${calId} not found for asset ${assetId}.`,
				);
			}

			let serviceEventId: number | null = hasServiceEventColumn
				? (existing.rows[0].service_event_id ?? null)
				: null;
			const createdNewServiceEvent = Boolean(certificate) && !serviceEventId;

			if (certificate) {
				if (!serviceEventId) {
					const eventType = await client.query(
						"SELECT id FROM asset_service_event_types WHERE name = $1",
						[CALIBRATION_EVENT_TYPE],
					);
					const eventInsert = await client.query(
						`INSERT INTO asset_service_events (asset_id, event_type_id, event_date, changed_by)
             VALUES ($1, $2, $3, $4) RETURNING id`,
						[assetId, eventType.rows[0].id, dto.calDate, userId],
					);
					serviceEventId = eventInsert.rows[0].id;
				}
				// A second certificate on the same service event just
				// supersedes the first -- the catalogue's LATERAL join
				// already picks the latest by created_at, same "current =
				// latest by date" pattern as everywhere else. The old file
				// stays on disk, functionally superseded rather than
				// deleted.
				const { fileReference } =
					await this.documents.saveUploadedFile(certificate);
				await this.documents.createDocumentRecord(client, {
					assetId,
					serviceEventId: serviceEventId as number,
					documentType: "certificate",
					fileReference,
					changedBy: userId,
				});
			}

			const setParts = [`${dateColumn} = $1`, "changed_by = $2"];
			const values: unknown[] = [dto.calDate, userId];
			let i = 3;
			for (const col of allColumns) {
				setParts.push(`${col} = $${i}`);
				values.push(dto.coefficients[col] ?? null);
				i++;
			}
			if (createdNewServiceEvent) {
				setParts.push(`service_event_id = $${i}`);
				values.push(serviceEventId);
				i++;
			}
			values.push(calId);

			await client.query(
				`UPDATE ${table} SET ${setParts.join(", ")} WHERE id = $${i}`,
				values,
			);

			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
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
