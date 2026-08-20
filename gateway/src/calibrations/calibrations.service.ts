import { Inject, Injectable } from "@nestjs/common";
import type {
	CalibrationCatalogueModelGroup,
	CalibrationCatalogueRow,
	CalibrationCatalogueTypeGroup,
} from "@ogdb/types";
import type { Pool } from "pg";
import { CAL_TABLES } from "../common/asset-tables";
import { PG_POOL } from "../db/db.constants";

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

			const result = await this.pool.query(
				`SELECT c.*, a.serial_number AS "serialNumber",
                l22.id AS "modelId", l22.pref_label AS "model", l22.uri AS "modelUri"
           FROM ${table} c
           JOIN assets a ON a.id = c.asset_id
           LEFT JOIN asset_sensor_details asd ON asd.asset_id = a.id
           LEFT JOIN nvs_terms l22 ON l22.id = asd.l22_model_id
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
					serialNumber,
					modelId,
					model,
					modelUri,
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
					serialNumber,
					calDate,
					facility: calibration_facility ?? null,
					coefficients,
				};
				group.rows.push(calibrationRow);
			}

			groups.push({ assetType, models: Array.from(modelGroups.values()) });
		}

		return groups;
	}
}
