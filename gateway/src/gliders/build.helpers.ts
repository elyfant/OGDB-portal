import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import type {
	BuildChange,
	GliderBuild,
	GliderBuildComponent,
	GliderComponentDetail,
	GliderDeployment,
	GliderEditHistoryItem,
	GliderStatusHistoryItem,
	MeasuredParameter,
	MissionsSummary,
	NewAssetInput,
	ScienceSensorRecord,
	SensorCalRecord,
} from "@ogdb/types";
import type { Pool, PoolClient } from "pg";
import {
	CAL_TABLES,
	CAL_TABLES_WITH_SERVICE_EVENT,
	DETAIL_TABLES,
	FLAT_MODEL_TABLES,
	VALID_PARENT_TYPES,
} from "../common/asset-tables";

// Mirrors missions.service.ts's DAYS_EXPR/getSummary exactly, scoped to
// one glider instead of the whole fleet — kept as a separate query
// against missions directly (glider_asset_id lives there) rather than
// norglider_missions, which only exposes the glider's name, not its id.
const DAYS_EXPR =
	"ROUND(EXTRACT(EPOCH FROM (recovery_date - launch_date)) / 86400.0)";

// $2 (asOfDate) defaults to CURRENT_DATE via COALESCE when not passed --
// existing callers (always "today", e.g. the glider detail page's
// Current Build) don't need a second query variant. An assignment is
// "active as of date D" when it started on/before D and either hasn't
// ended, or ended after D -- reconstructs the build as it looked on any
// past date, not just the live one.
const BUILD_TREE_SQL = `
  WITH RECURSIVE build AS (
    SELECT aa.id AS assignment_id, aa.child_asset_id AS asset_id, aa.parent_asset_id,
           aa.start_date, aa.position, 1 AS depth
    FROM asset_assignments aa
    WHERE aa.parent_asset_id = $1
      AND aa.start_date <= COALESCE($2, CURRENT_DATE)
      AND (aa.end_date IS NULL OR aa.end_date > COALESCE($2, CURRENT_DATE))
    UNION ALL
    SELECT aa.id, aa.child_asset_id, aa.parent_asset_id, aa.start_date, aa.position, build.depth + 1
    FROM asset_assignments aa
    JOIN build ON aa.parent_asset_id = build.asset_id
    WHERE aa.start_date <= COALESCE($2, CURRENT_DATE)
      AND (aa.end_date IS NULL OR aa.end_date > COALESCE($2, CURRENT_DATE))
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
	asOfDate?: string | null,
): Promise<GliderBuildComponent[]> {
	const result = await pool.query(BUILD_TREE_SQL, [
		gliderAssetId,
		asOfDate ?? null,
	]);
	return result.rows;
}

// "Model" is resolved differently per type: science sensors (NVS L22),
// batteries (battery_models), hulls (hull_models), and everything in
// FLAT_MODEL_TABLES (a plain `model` column on the detail table). Only
// argos_tag/nose_cone have no model concept at all — see
// docs/design/build-hierarchy.md "Real remaining gaps".
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

// asset_sensor_parameters (P01, many-to-many) -- "readable format for
// now" per Fiona: just the preferred label, no definition text. Grouped
// by asset since a sensor can output more than one parameter (a CT
// sensor reports both temperature and conductivity).
async function fetchMeasuredParameters(
	pool: Pool,
	sensorAssetIds: number[],
): Promise<Map<number, MeasuredParameter[]>> {
	const byAsset = new Map<number, MeasuredParameter[]>();
	if (sensorAssetIds.length === 0) return byAsset;

	const result = await pool.query(
		`SELECT asp.asset_id AS "assetId", t.pref_label AS label, t.uri
     FROM asset_sensor_parameters asp
     JOIN nvs_terms t ON t.id = asp.p01_term_id
     WHERE asp.asset_id = ANY($1)
     ORDER BY t.pref_label`,
		[sensorAssetIds],
	);
	for (const row of result.rows) {
		const list = byAsset.get(row.assetId) ?? [];
		list.push({ label: row.label, uri: row.uri });
		byAsset.set(row.assetId, list);
	}
	return byAsset;
}

// The single calibration record in effect as of a given date, per
// sensor -- "latest cal_date <= asOfDate" per asset, not the full
// history CalibrationHistory/fetchComponentDetails show elsewhere. null
// when nothing on record is that old yet.
async function fetchCalibrationAsOf(
	pool: Pool,
	sensorAssetIds: number[],
	asOfDate: string,
): Promise<Map<number, SensorCalRecord>> {
	const byAsset = new Map<number, SensorCalRecord>();
	if (sensorAssetIds.length === 0) return byAsset;

	const byType = new Map<string, number[]>();
	const typeResult = await pool.query(
		`SELECT a.id AS "assetId", at.name AS "assetType"
     FROM assets a JOIN asset_types at ON at.id = a.asset_type_id
     WHERE a.id = ANY($1)`,
		[sensorAssetIds],
	);
	for (const row of typeResult.rows) {
		const list = byType.get(row.assetType) ?? [];
		list.push(row.assetId);
		byType.set(row.assetType, list);
	}

	for (const [assetType, ids] of byType.entries()) {
		const calInfo = CAL_TABLES[assetType];
		if (!calInfo) continue;
		const [table, dateColumn] = calInfo;
		const result = await pool.query(
			`SELECT DISTINCT ON (asset_id) *
       FROM ${table}
       WHERE asset_id = ANY($1) AND ${dateColumn} <= $2
       ORDER BY asset_id, ${dateColumn} DESC, id DESC`,
			[ids, asOfDate],
		);
		for (const row of result.rows) {
			const {
				id,
				asset_id,
				changed_by,
				created_at,
				[dateColumn]: date,
				...coefficients
			} = row;
			byAsset.set(asset_id, { date, coefficients });
		}
	}

	return byAsset;
}

// Science Payload for one glider as of one date -- everything here uses
// that date, not "today": which sensors were actually attached (via
// fetchBuildTree's asOfDate), and which calibration was in effect on
// each (fetchCalibrationAsOf), not whatever they're calibrated to now.
export async function getMissionSciencePayload(
	pool: Pool,
	gliderAssetId: number,
	asOfDate: string,
): Promise<ScienceSensorRecord[]> {
	const buildTree = await fetchBuildTree(pool, gliderAssetId, asOfDate);
	const sensors = buildTree.filter((c) => c.assetTypeGroup === "sensor");
	const sensorIds = sensors.map((c) => c.assetId);

	const [models, measuredParameters, calibrations] = await Promise.all([
		fetchModels(pool, sensors),
		fetchMeasuredParameters(pool, sensorIds),
		fetchCalibrationAsOf(pool, sensorIds, asOfDate),
	]);

	return sensors.map((c) => {
		const info = models.get(c.assetId);
		return {
			assetId: c.assetId,
			assetType: c.assetType,
			serialNumber: c.serialNumber,
			model: info?.model ?? null,
			modelUri: info?.uri ?? null,
			measuredParameters: measuredParameters.get(c.assetId) ?? [],
			calibration: calibrations.get(c.assetId) ?? null,
			asOfDate,
		};
	});
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
				// Only ct_sensor's cal table has service_event_id -- same
				// certificate join as CalibrationsService.getCatalogue, just
				// scoped to one asset instead of every asset of that type.
				// coefficients is left untouched (still includes
				// calibration_facility/note/service_event_id for ct_sensor,
				// same as before this change) so CalibrationHistory's generic
				// coefficient dump doesn't lose rows -- documentId rides
				// alongside as its own field instead.
				const documentJoin =
					CAL_TABLES_WITH_SERVICE_EVENT.has(table)
						? `LEFT JOIN LATERAL (
							SELECT id FROM documents
							WHERE service_event_id = c.service_event_id
							AND file_reference ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-'
							ORDER BY created_at DESC LIMIT 1
						 ) doc ON true`
						: "";
				const documentSelect =
					CAL_TABLES_WITH_SERVICE_EVENT.has(table)
						? `, doc.id AS "documentId"`
						: `, NULL::int AS "documentId"`;
				const result = await pool.query(
					`SELECT c.*${documentSelect}
             FROM ${table} c
             ${documentJoin}
            WHERE c.asset_id = $1
            ORDER BY c.${dateColumn} DESC`,
					[c.assetId],
				);
				calibrations = result.rows.map((row) => {
					const {
						id,
						asset_id,
						changed_by,
						created_at,
						documentId,
						[dateColumn]: date,
						...coefficients
					} = row;
					return { date, coefficients, documentId: documentId ?? null };
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

async function fetchMissionsSummary(
	pool: Pool,
	gliderAssetId: number,
): Promise<MissionsSummary> {
	const result = await pool.query(
		`SELECT
       COUNT(*)::int AS "totalMissions",
       COALESCE(SUM(dives), 0)::int AS "totalDives",
       ROUND(COALESCE(SUM(distance_km), 0)::numeric)::int AS "totalDistanceKm",
       COALESCE(SUM(${DAYS_EXPR}), 0)::int AS "totalDays"
     FROM missions
     WHERE glider_asset_id = $1`,
		[gliderAssetId],
	);
	return result.rows[0];
}

export async function getGliderBuild(
	pool: Pool,
	gliderAssetId: number,
): Promise<GliderBuild> {
	const rawBuildTree = await fetchBuildTree(pool, gliderAssetId);
	const allAssetIds = [gliderAssetId, ...rawBuildTree.map((c) => c.assetId)];

	const [
		statusHistory,
		models,
		componentDetails,
		deployments,
		missionsSummary,
	] = await Promise.all([
		fetchStatusHistory(pool, allAssetIds),
		fetchModels(pool, rawBuildTree),
		fetchComponentDetails(pool, rawBuildTree),
		fetchDeployments(pool, gliderAssetId),
		fetchMissionsSummary(pool, gliderAssetId),
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
		missionsSummary,
		statusHistory,
		editHistory,
	};
}

// Enforces docs/design/build-hierarchy.md's "Valid parent(s) by asset
// type" table -- the write-path validation that table was always meant
// for. Not yet a DB-level constraint, so this is the only thing standing
// between a typo and a battery assigned under a CT sensor.
async function assertValidParent(
	client: PoolClient,
	childAssetId: number,
	parentAssetId: number,
): Promise<void> {
	const result = await client.query(
		`SELECT childType.name AS "childType", parentType.name AS "parentType"
     FROM assets child
     JOIN asset_types childType ON childType.id = child.asset_type_id
     JOIN assets parent ON parent.id = $2
     JOIN asset_types parentType ON parentType.id = parent.asset_type_id
     WHERE child.id = $1`,
		[childAssetId, parentAssetId],
	);
	if (result.rows.length === 0) {
		throw new NotFoundException(
			`Asset ${childAssetId} or ${parentAssetId} does not exist.`,
		);
	}
	const { childType, parentType } = result.rows[0];
	const validParents = VALID_PARENT_TYPES[childType];
	if (validParents && !validParents.includes(parentType)) {
		throw new ConflictException(
			`${childType} cannot be assigned under a ${parentType} -- valid parent(s): ${validParents.join(", ")}.`,
		);
	}
}

// Exactly one of childAssetId/newAsset is expected. newAsset covers only
// the simple case (serial + flat model text) -- battery/hull model
// lookups and arbitrary detail fields still go through the worksheet
// script, not this UI.
async function resolveOrCreateAsset(
	client: PoolClient,
	userId: number,
	childAssetId: number | undefined,
	newAsset: NewAssetInput | undefined,
): Promise<number> {
	if (childAssetId) return childAssetId;
	if (!newAsset) {
		throw new BadRequestException(
			"Each replace/add change needs either childAssetId or newAsset.",
		);
	}

	const typeResult = await client.query(
		"SELECT id FROM asset_types WHERE name = $1",
		[newAsset.assetType],
	);
	if (typeResult.rows.length === 0) {
		throw new BadRequestException(`Unknown asset type: ${newAsset.assetType}`);
	}
	const assetTypeId = typeResult.rows[0].id;

	const assetResult = await client.query(
		"INSERT INTO assets (asset_type_id, serial_number, changed_by) VALUES ($1, $2, $3) RETURNING id",
		[assetTypeId, newAsset.serialNumber, userId],
	);
	const assetId = assetResult.rows[0].id;

	const flatTable = FLAT_MODEL_TABLES[newAsset.assetType];
	if (flatTable && newAsset.model) {
		await client.query(
			`INSERT INTO ${flatTable} (asset_id, model) VALUES ($1, $2)`,
			[assetId, newAsset.model],
		);
	}

	return assetId;
}

// Applies a batch of BuildChange entries inside an already-open
// transaction -- the caller owns BEGIN/COMMIT/ROLLBACK. Shared by
// GlidersService.applyBuildChanges (editing an existing glider's live
// build) and MissionsService.createMission (setting a brand-new
// mission's initial build in the very same transaction as the mission
// row itself, so a failure partway through can't create a mission with
// no build or vice versa).
export async function applyBuildChangesTx(
	client: PoolClient,
	changes: BuildChange[],
	effectiveDate: string,
	missionId: number | null,
	notes: string | null | undefined,
	userId: number,
): Promise<void> {
	for (const change of changes) {
		if (change.action === "replace") {
			const old = await client.query(
				"SELECT parent_asset_id, position FROM asset_assignments WHERE id = $1 AND end_date IS NULL FOR UPDATE",
				[change.assignmentId],
			);
			if (old.rows.length === 0) {
				throw new ConflictException(
					`Assignment ${change.assignmentId} is not currently open -- it may have already been changed.`,
				);
			}
			const { parent_asset_id: parentAssetId, position } = old.rows[0];
			const childAssetId = await resolveOrCreateAsset(
				client,
				userId,
				change.childAssetId,
				change.newAsset,
			);
			await assertValidParent(client, childAssetId, parentAssetId);

			await client.query(
				"UPDATE asset_assignments SET end_date = $1, updated_at = now(), changed_by = $2 WHERE id = $3",
				[effectiveDate, userId, change.assignmentId],
			);
			await client.query(
				`INSERT INTO asset_assignments
           (child_asset_id, parent_asset_id, start_date, position, mission_id, notes, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[
					childAssetId,
					parentAssetId,
					effectiveDate,
					position,
					missionId,
					notes ?? null,
					userId,
				],
			);
		} else if (change.action === "remove") {
			const old = await client.query(
				"SELECT child_asset_id FROM asset_assignments WHERE id = $1 AND end_date IS NULL FOR UPDATE",
				[change.assignmentId],
			);
			if (old.rows.length === 0) {
				throw new ConflictException(
					`Assignment ${change.assignmentId} is not currently open -- it may have already been changed.`,
				);
			}
			await client.query(
				"UPDATE asset_assignments SET end_date = $1, updated_at = now(), changed_by = $2 WHERE id = $3",
				[effectiveDate, userId, change.assignmentId],
			);
			if (change.newStatusId) {
				await client.query(
					"INSERT INTO asset_status_history (asset_id, status_id, effective_date, notes, changed_by) VALUES ($1, $2, $3, $4, $5)",
					[
						old.rows[0].child_asset_id,
						change.newStatusId,
						effectiveDate,
						change.statusNotes ?? null,
						userId,
					],
				);
			}
		} else if (change.action === "add") {
			const childAssetId = await resolveOrCreateAsset(
				client,
				userId,
				change.childAssetId,
				change.newAsset,
			);
			await assertValidParent(client, childAssetId, change.parentAssetId);
			await client.query(
				`INSERT INTO asset_assignments
           (child_asset_id, parent_asset_id, start_date, position, mission_id, notes, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[
					childAssetId,
					change.parentAssetId,
					effectiveDate,
					change.position ?? null,
					missionId,
					notes ?? null,
					userId,
				],
			);
		} else {
			throw new BadRequestException(
				`Unknown change action: ${JSON.stringify(change)}`,
			);
		}
	}
}
