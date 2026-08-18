import type {
	GliderBuild,
	GliderBuildComponent,
	GliderComponentDetail,
	GliderDeployment,
	GliderEditHistoryItem,
	GliderStatusHistoryItem,
} from "@ogdb/types";
import type { Pool } from "pg";

// asset_types.name -> detail table name, mirrors OGDB's
// scripts/build_glider_assignments.py ASSEMBLY_NUMBER_LOOKUP/DETAIL_TABLES
// constants — keep these two in sync if the schema changes.
const DETAIL_TABLES: Record<string, string> = {
	glider: "asset_glider_details",
	slocum_aft_section: "asset_slocum_aft_section_details",
	slocum_forward_section: "asset_slocum_forward_section_details",
	slocum_end_cap: "asset_slocum_end_cap_details",
	slocum_payload_bay: "asset_slocum_payload_bay_details",
	slocum_hull: "asset_slocum_hull_details",
	slocum_altimeter: "asset_slocum_altimeter_details",
	slocum_energy_bay: "asset_slocum_energy_bay_details",
	battery: "asset_battery_details",
	ct_sensor: "asset_sensor_details",
	do_sensor: "asset_sensor_details",
	eco_sensor: "asset_sensor_details",
	mr_sensor: "asset_sensor_details",
};

// Types whose detail table has a plain `model` text column, no NVS/
// battery_models/hull_models indirection needed — added 2026-08-18 once
// Fiona had real part-number values for these. Distinct from
// DETAIL_TABLES above only in that this list feeds fetchModels' generic
// branch; every one of these is also in DETAIL_TABLES.
const FLAT_MODEL_TABLES: Record<string, string> = {
	slocum_aft_section: "asset_slocum_aft_section_details",
	slocum_forward_section: "asset_slocum_forward_section_details",
	slocum_end_cap: "asset_slocum_end_cap_details",
	slocum_payload_bay: "asset_slocum_payload_bay_details",
	slocum_altimeter: "asset_slocum_altimeter_details",
	slocum_energy_bay: "asset_slocum_energy_bay_details",
};

// asset_types.name -> [cal table, its date column]. Only these four types
// have a dedicated calibration history table.
const CAL_TABLES: Record<string, [table: string, dateColumn: string]> = {
	ct_sensor: ["asset_ct_sensor_cal", "cal_date"],
	do_sensor: ["asset_do_sensor_cal", "cal_date"],
	eco_sensor: ["asset_eco_sensor_cal", "cal_date"],
	slocum_forward_section: ["asset_slocum_forward_section_cal", "service_date"],
};

const BUILD_TREE_SQL = `
  WITH RECURSIVE build AS (
    SELECT aa.id AS assignment_id, aa.child_asset_id AS asset_id, aa.parent_asset_id,
           aa.start_date, aa.position, 1 AS depth
    FROM asset_assignments aa
    WHERE aa.parent_asset_id = $1 AND aa.end_date IS NULL
    UNION ALL
    SELECT aa.id, aa.child_asset_id, aa.parent_asset_id, aa.start_date, aa.position, build.depth + 1
    FROM asset_assignments aa
    JOIN build ON aa.parent_asset_id = build.asset_id
    WHERE aa.end_date IS NULL
  )
  SELECT
    build.assignment_id AS "assignmentId",
    build.asset_id AS "assetId",
    build.parent_asset_id AS "parentAssetId",
    build.start_date AS "installDate",
    build.position,
    build.depth,
    a.serial_number AS "serialNumber",
    at.name AS "assetType",
    atg.name AS "assetTypeGroup"
  FROM build
  JOIN assets a ON a.id = build.asset_id
  JOIN asset_types at ON at.id = a.asset_type_id
  JOIN asset_type_groups atg ON atg.id = at.group_id
  ORDER BY build.depth, at.name, a.serial_number
`;

async function fetchBuildTree(
	pool: Pool,
	gliderAssetId: number,
): Promise<GliderBuildComponent[]> {
	const result = await pool.query(BUILD_TREE_SQL, [gliderAssetId]);
	return result.rows;
}

// "Model" is resolved differently per type: science sensors (NVS L22),
// batteries (battery_models), hulls (hull_models), and everything in
// FLAT_MODEL_TABLES (a plain `model` column on the detail table). Only
// slocum_thruster/argos_tag/nose_cone have no model concept at all —
// see docs/design/build-hierarchy.md "Real remaining gaps".
interface ModelInfo {
	model: string | null;
	uri: string | null;
}

async function fetchModels(
	pool: Pool,
	buildTree: GliderBuildComponent[],
): Promise<Map<number, ModelInfo>> {
	const models = new Map<number, ModelInfo>();

	const sensorIds = buildTree
		.filter((c) => c.assetTypeGroup === "sensor")
		.map((c) => c.assetId);
	if (sensorIds.length) {
		const result = await pool.query(
			`SELECT asd.asset_id AS "assetId", t.pref_label AS model, t.uri
       FROM asset_sensor_details asd
       JOIN nvs_terms t ON t.id = asd.l22_model_id
       WHERE asd.asset_id = ANY($1)`,
			[sensorIds],
		);
		for (const row of result.rows) {
			models.set(row.assetId, { model: row.model, uri: row.uri });
		}
	}

	const batteryIds = buildTree
		.filter((c) => c.assetType === "battery")
		.map((c) => c.assetId);
	if (batteryIds.length) {
		const result = await pool.query(
			`SELECT abd.asset_id AS "assetId", bm.model
       FROM asset_battery_details abd
       JOIN battery_models bm ON bm.id = abd.battery_model_id
       WHERE abd.asset_id = ANY($1)`,
			[batteryIds],
		);
		for (const row of result.rows) {
			models.set(row.assetId, { model: row.model, uri: null });
		}
	}

	const hullIds = buildTree
		.filter((c) => c.assetType === "slocum_hull")
		.map((c) => c.assetId);
	if (hullIds.length) {
		const result = await pool.query(
			`SELECT hd.asset_id AS "assetId", hm.teledyne_part_number AS model
       FROM asset_slocum_hull_details hd
       JOIN hull_models hm ON hm.id = hd.hull_model_id
       WHERE hd.asset_id = ANY($1)`,
			[hullIds],
		);
		for (const row of result.rows) {
			models.set(row.assetId, { model: row.model, uri: null });
		}
	}

	for (const [assetType, table] of Object.entries(FLAT_MODEL_TABLES)) {
		const ids = buildTree
			.filter((c) => c.assetType === assetType)
			.map((c) => c.assetId);
		if (!ids.length) continue;
		const result = await pool.query(
			`SELECT asset_id AS "assetId", model FROM ${table} WHERE asset_id = ANY($1)`,
			[ids],
		);
		for (const row of result.rows) {
			if (row.model !== null)
				models.set(row.assetId, { model: row.model, uri: null });
		}
	}

	return models;
}

// Full detail-table row + full cal history per component, for the
// Current Build table's row expansion — this is the generic version of
// fetchModels/fetchSciencePayload above (which only pull curated fields
// for display elsewhere), covering every asset type with a detail or cal
// table, not just science sensors.
async function fetchComponentDetails(
	pool: Pool,
	buildTree: GliderBuildComponent[],
): Promise<GliderComponentDetail[]> {
	const results = await Promise.all(
		buildTree.map(async (c): Promise<GliderComponentDetail> => {
			const detailTable = DETAIL_TABLES[c.assetType];
			let detail: GliderComponentDetail["detail"] = null;
			if (detailTable) {
				const result = await pool.query(
					`SELECT * FROM ${detailTable} WHERE asset_id = $1`,
					[c.assetId],
				);
				if (result.rows[0]) {
					const { asset_id, ...fields } = result.rows[0];
					detail = fields;
				}
			}

			const calInfo = CAL_TABLES[c.assetType];
			let calibrations: GliderComponentDetail["calibrations"] = null;
			if (calInfo) {
				const [table, dateColumn] = calInfo;
				const result = await pool.query(
					`SELECT * FROM ${table} WHERE asset_id = $1 ORDER BY ${dateColumn} DESC`,
					[c.assetId],
				);
				calibrations = result.rows.map((row) => {
					const {
						id,
						asset_id,
						changed_by,
						created_at,
						[dateColumn]: date,
						...coefficients
					} = row;
					return { date, coefficients };
				});
			}

			return { assetId: c.assetId, detail, calibrations };
		}),
	);
	return results.filter((r) => r.detail !== null || r.calibrations !== null);
}

async function fetchStatusHistory(
	pool: Pool,
	assetIds: number[],
): Promise<GliderStatusHistoryItem[]> {
	if (assetIds.length === 0) return [];
	const result = await pool.query(
		`SELECT ash.id, ash.asset_id AS "assetId", at.name AS "assetType", a.serial_number AS "serialNumber",
            aso.name AS status, ash.effective_date AS "effectiveDate", ash.notes,
            u.email AS "changedByEmail"
     FROM asset_status_history ash
     JOIN assets a ON a.id = ash.asset_id
     JOIN asset_types at ON at.id = a.asset_type_id
     JOIN asset_status_options aso ON aso.id = ash.status_id
     LEFT JOIN users u ON u.id = ash.changed_by
     WHERE ash.asset_id = ANY($1)
     ORDER BY ash.effective_date DESC, ash.id DESC`,
		[assetIds],
	);
	return result.rows;
}

async function fetchEditHistory(
	pool: Pool,
	gliderAssetId: number,
	buildTree: GliderBuildComponent[],
	statusHistory: GliderStatusHistoryItem[],
): Promise<GliderEditHistoryItem[]> {
	const allAssetIds = [gliderAssetId, ...buildTree.map((c) => c.assetId)];

	const typeResult = await pool.query(
		`SELECT a.id AS "assetId", at.name AS "assetType"
     FROM assets a JOIN asset_types at ON at.id = a.asset_type_id
     WHERE a.id = ANY($1)`,
		[allAssetIds],
	);
	const idsByType = new Map<string, number[]>();
	for (const row of typeResult.rows) {
		const list = idsByType.get(row.assetType) ?? [];
		list.push(row.assetId);
		idsByType.set(row.assetType, list);
	}

	const groups: { table: string; ids: number[] }[] = [
		{ table: "assets", ids: allAssetIds },
		{ table: "asset_assignments", ids: buildTree.map((c) => c.assignmentId) },
		{ table: "asset_status_history", ids: statusHistory.map((s) => s.id) },
	];

	for (const [assetType, table] of Object.entries(DETAIL_TABLES)) {
		const ids = idsByType.get(assetType);
		if (ids?.length) groups.push({ table, ids });
	}

	for (const [assetType, [table]] of Object.entries(CAL_TABLES)) {
		const ids = idsByType.get(assetType);
		if (!ids?.length) continue;
		const calIdsResult = await pool.query(
			`SELECT id FROM ${table} WHERE asset_id = ANY($1)`,
			[ids],
		);
		if (calIdsResult.rows.length) {
			groups.push({ table, ids: calIdsResult.rows.map((r) => r.id) });
		}
	}

	const nonEmpty = groups.filter((g) => g.ids.length > 0);
	if (nonEmpty.length === 0) return [];

	const clauses: string[] = [];
	const params: unknown[] = [];
	for (const g of nonEmpty) {
		params.push(g.table, g.ids);
		clauses.push(
			`(table_name = $${params.length - 1} AND row_id = ANY($${params.length}))`,
		);
	}

	const result = await pool.query(
		`SELECT al.table_name AS "tableName", al.row_id AS "rowId", al.operation,
            al.changed_at AS "changedAt", u.email AS "changedByEmail"
     FROM audit_log al
     LEFT JOIN users u ON u.id = al.changed_by
     WHERE ${clauses.join(" OR ")}
     ORDER BY al.changed_at DESC`,
		params,
	);
	return result.rows;
}

// norglider_missions.id === missions.id (it's a straight view over
// missions with joined-in labels) -- filtering by missions.glider_asset_id
// is the real FK relationship; norglider_missions itself only exposes
// the glider's name, not its id, so the filter has to join back.
async function fetchDeployments(
	pool: Pool,
	gliderAssetId: number,
): Promise<GliderDeployment[]> {
	const result = await pool.query(
		`SELECT nm.id, nm.mission_number AS "missionNumber",
            nm.std_mission_name AS "stdMissionName", nm.status, nm.site,
            nm.launch_date AS "launchDate", nm.recovery_date AS "recoveryDate",
            nm.dives, nm.distance_km AS "distanceKm"
     FROM norglider_missions nm
     JOIN missions m ON m.id = nm.id
     WHERE m.glider_asset_id = $1
     ORDER BY nm.launch_date DESC NULLS LAST`,
		[gliderAssetId],
	);
	return result.rows;
}

export async function getGliderBuild(
	pool: Pool,
	gliderAssetId: number,
): Promise<GliderBuild> {
	const rawBuildTree = await fetchBuildTree(pool, gliderAssetId);
	const allAssetIds = [gliderAssetId, ...rawBuildTree.map((c) => c.assetId)];

	const [statusHistory, models, componentDetails, deployments] =
		await Promise.all([
			fetchStatusHistory(pool, allAssetIds),
			fetchModels(pool, rawBuildTree),
			fetchComponentDetails(pool, rawBuildTree),
			fetchDeployments(pool, gliderAssetId),
		]);
	const buildTree = rawBuildTree.map((c) => {
		const info = models.get(c.assetId);
		return { ...c, model: info?.model ?? null, modelUri: info?.uri ?? null };
	});
	const editHistory = await fetchEditHistory(
		pool,
		gliderAssetId,
		buildTree,
		statusHistory,
	);

	return {
		components: buildTree,
		componentDetails,
		deployments,
		statusHistory,
		editHistory,
	};
}
