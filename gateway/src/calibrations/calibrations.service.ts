import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
	CalibrationCatalogueModelGroup,
	CalibrationCatalogueRow,
	CalibrationCatalogueTypeGroup,
} from "@ogdb/types";
import type { Pool } from "pg";
import {
	CAL_TABLES,
	CAL_TABLES_WITH_SERVICE_EVENT,
} from "../common/asset-tables";
import { PG_POOL } from "../db/db.constants";
import { originalNameFromReference } from "../documents/documents.service";

// The "sensor" asset_type_group, in catalogue display order. Not every
// CAL_TABLES entry belongs here -- slocum_forward_section has a cal
// table too but is structural, not science, so it's excluded.
const SCIENCE_ASSET_TYPES = [
	"ct_sensor",
	"do_sensor",
	"eco_sensor",
	"mr_sensor",
];

@Injectable()
export class CalibrationsService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	// Full calibration history for every science sensor, grouped by
	// asset type then by NVS L22 model -- unlike getMissionSciencePayload
	// (one calibration per sensor, as of one mission date), this returns
	// every record ever entered, for a cross-asset view rather than a
	// per-mission one.
	async getCatalogue(): Promise<CalibrationCatalogueTypeGroup[]> {
		const groups: CalibrationCatalogueTypeGroup[] = [];

		for (const assetType of SCIENCE_ASSET_TYPES) {
			const calInfo = CAL_TABLES[assetType];
			if (!calInfo) continue;
			const [table, dateColumn] = calInfo;

			// Only ct_sensor's cal table has service_event_id -- the join
			// to documents (a calibration's certificate, if one was
			// uploaded) only applies there. LATERAL + LIMIT 1 rather than
			// a plain join, so this can never multiply rows even if more
			// than one document ever ends up on the same service event
			// (the policy is one bundled PDF per calibration, but nothing
			// at the DB level enforces that).
			// file_reference must match the UUID-prefixed local-storage
			// pattern -- historical rows backfilled before this VM-storage
			// design store the original legacy share path instead (e.g.
			// "/Data/gfi/projects/.../CERT.pdf"), which was never copied
			// here and can't be served. Those are excluded rather than
			// surfacing a link that 404s; Fiona will re-upload them by hand.
			const documentJoin = CAL_TABLES_WITH_SERVICE_EVENT.has(table)
				? `LEFT JOIN LATERAL (
					SELECT id, file_reference FROM documents
					WHERE service_event_id = c.service_event_id
					AND file_reference ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-'
					ORDER BY created_at DESC LIMIT 1
				 ) doc ON true`
				: "";
			const documentSelect = CAL_TABLES_WITH_SERVICE_EVENT.has(table)
				? `, doc.id AS "certificateDocumentId", doc.file_reference AS "certificateFileReference"`
				: `, NULL AS "certificateDocumentId", NULL AS "certificateFileReference"`;

			const result = await this.pool.query(
				`SELECT c.*, a.serial_number AS "serialNumber",
                l22.id AS "modelId", l22.pref_label AS "model", l22.uri AS "modelUri"
                ${documentSelect}
           FROM ${table} c
           JOIN assets a ON a.id = c.asset_id
           LEFT JOIN asset_sensor_details asd ON asd.asset_id = a.id
           LEFT JOIN nvs_terms l22 ON l22.id = asd.l22_model_id
           ${documentJoin}
          ORDER BY l22.pref_label NULLS LAST, a.serial_number, c.${dateColumn} DESC`,
			);

			const modelGroups = new Map<string, CalibrationCatalogueModelGroup>();
			for (const row of result.rows) {
				const {
					id,
					asset_id,
					changed_by,
					created_at,
					calibration_facility,
					note,
					service_event_id,
					serialNumber,
					modelId,
					model,
					modelUri,
					certificateDocumentId,
					certificateFileReference,
					[dateColumn]: calDate,
					...coefficients
				} = row;

				const key = modelId === null ? "unspecified" : String(modelId);
				let group = modelGroups.get(key);
				if (!group) {
					group = { modelId, model, modelUri, rows: [] };
					modelGroups.set(key, group);
				}

				const calibrationRow: CalibrationCatalogueRow = {
					id,
					assetId: asset_id,
					assetType,
					serialNumber,
					calDate,
					facility: calibration_facility ?? null,
					notes: note ?? null,
					coefficients,
					certificateDocumentId: certificateDocumentId ?? null,
					certificateDocumentName: certificateFileReference
						? originalNameFromReference(certificateFileReference)
						: null,
				};
				group.rows.push(calibrationRow);
			}

			groups.push({ assetType, models: Array.from(modelGroups.values()) });
		}

		return groups;
	}

	// One asset's full calibration history, newest first -- the per-asset
	// counterpart to getCatalogue's cross-asset view above, and the first
	// of the asset-timeline event feeds (missions, servicing, pilot logs
	// follow the same shape: 404 if the asset itself doesn't exist, empty
	// array if the asset's type just doesn't have this kind of event, no
	// row-level error either way). Same document-join treatment as
	// getCatalogue for the reasons noted there.
	async getForAsset(assetId: number): Promise<CalibrationCatalogueRow[]> {
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
			return [];
		}
		const [table, dateColumn] = calInfo;

		const documentJoin = CAL_TABLES_WITH_SERVICE_EVENT.has(table)
			? `LEFT JOIN LATERAL (
					SELECT id, file_reference FROM documents
					WHERE service_event_id = c.service_event_id
					AND file_reference ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-'
					ORDER BY created_at DESC LIMIT 1
				 ) doc ON true`
			: "";
		const documentSelect = CAL_TABLES_WITH_SERVICE_EVENT.has(table)
			? `, doc.id AS "certificateDocumentId", doc.file_reference AS "certificateFileReference"`
			: `, NULL AS "certificateDocumentId", NULL AS "certificateFileReference"`;

		const result = await this.pool.query(
			`SELECT c.*, a.serial_number AS "serialNumber"
              ${documentSelect}
         FROM ${table} c
         JOIN assets a ON a.id = c.asset_id
         ${documentJoin}
        WHERE c.asset_id = $1
        ORDER BY c.${dateColumn} DESC`,
			[assetId],
		);

		return result.rows.map((row) => {
			const {
				id,
				asset_id,
				changed_by,
				created_at,
				calibration_facility,
				note,
				service_event_id,
				serialNumber,
				certificateDocumentId,
				certificateFileReference,
				[dateColumn]: calDate,
				...coefficients
			} = row;

			const calibrationRow: CalibrationCatalogueRow = {
				id,
				assetId: asset_id,
				assetType,
				serialNumber,
				calDate,
				facility: calibration_facility ?? null,
				notes: note ?? null,
				coefficients,
				certificateDocumentId: certificateDocumentId ?? null,
				certificateDocumentName: certificateFileReference
					? originalNameFromReference(certificateFileReference)
					: null,
			};
			return calibrationRow;
		});
	}
}
