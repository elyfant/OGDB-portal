import {
	BadRequestException,
	ConflictException,
	NotFoundException,
} from "@nestjs/common";
import type {
	BuildChange,
	BuildMissionRef,
	GliderBuild,
	GliderBuildComponent,
	GliderComponentDetail,
	GliderDeployment,
	GliderEditHistoryItem,
	GliderStatusHistoryItem,
	MeasuredParameter,
	MissionBuild,
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
import { originalNameFromReference } from "../documents/documents.service";

// Mirrors missions.service.ts's DAYS_EXPR/getSummary exactly, scoped to
// one glider instead of the whole fleet — kept as a separate query
// against missions directly (glider_asset_id lives there) rather than
// norglider_missions, which only exposes the glider's name, not its id.
const DAYS_EXPR =
	"ROUND(EXTRACT(EPOCH FROM (recovery_date - launch_date)) / 86400.0)";

type Db = Pool | PoolClient;

// A mission's build is never edited on the glider: every build belongs to a
// mission (mission_build_items), and a mission's status says whether it is
// still being prepared. "workshop" = glider being prepared, only the glider
// known; "scheduled" = assigned a mission; "active" = at sea.
const PRE_LAUNCH_STATUSES = ["workshop", "scheduled"];

// A component before models are looked up.
type RawComponent = Omit<GliderBuildComponent, "model" | "modelUri">;

// One mission's build items, as a flat list with each part's depth
// (0 = mounted directly on the glider is depth 1, matching the old tree).
// The aft section is an ordinary item here (see OGDB
// xxxx_mission_build_items), so nothing is grafted in on read.
async function fetchMissionTree(
	db: Db,
	missionId: number,
): Promise<RawComponent[]> {
	const result = await db.query(
		`SELECT i.id AS "itemId", i.asset_id AS "assetId",
            i.parent_item_id AS "parentItemId",
            COALESCE(p.asset_id, m.glider_asset_id) AS "parentAssetId",
            i."position" AS position,
            a.serial_number AS "serialNumber",
            at.name AS "assetType", atg.name AS "assetTypeGroup"
     FROM mission_build_items i
     JOIN missions m ON m.id = i.mission_id
     LEFT JOIN mission_build_items p ON p.id = i.parent_item_id
     JOIN assets a ON a.id = i.asset_id
     JOIN asset_types at ON at.id = a.asset_type_id
     JOIN asset_type_groups atg ON atg.id = at.group_id
     WHERE i.mission_id = $1`,
		[missionId],
	);
	const parentOf = new Map<number, number | null>(
		result.rows.map((r) => [r.itemId, r.parentItemId]),
	);
	const depthOf = (itemId: number): number => {
		let depth = 1;
		let current = parentOf.get(itemId) ?? null;
		// The composite FK rules out cycles; the bound is belt and braces.
		while (current !== null && depth < 20) {
			depth++;
			current = parentOf.get(current) ?? null;
		}
		return depth;
	};
	return result.rows
		.map(({ parentItemId: _parent, ...r }) => ({
			...r,
			depth: depthOf(r.itemId),
		}))
		.sort(
			(a, b) =>
				a.depth - b.depth ||
				a.assetType.localeCompare(b.assetType) ||
				(a.serialNumber ?? "").localeCompare(b.serialNumber ?? ""),
		);
}

// Exported for AssetsService.setDecommission: the glider's most recent
// recorded build -- what "retire these components along with the glider"
// is validated against.
export async function fetchLatestBuildTree(
	pool: Pool,
	gliderAssetId: number,
): Promise<GliderBuildComponent[]> {
	const mission = await fetchLastFlownMission(pool, gliderAssetId);
	if (!mission) return [];
	const raw = await fetchMissionTree(pool, mission.id);
	const models = await fetchModels(pool, raw);
	return raw.map((c) => {
		const info = models.get(c.assetId);
		return { ...c, model: info?.model ?? null, modelUri: info?.uri ?? null };
	});
}

const MISSION_REF_SELECT = `
  SELECT m.id, m.mission_number AS "missionNumber", m.mission_name AS "missionName",
         nm.std_mission_name AS "stdMissionName", s.name AS status,
         m.launch_date::date::text AS "launchDate",
         m.recovery_date::date::text AS "recoveryDate"
  FROM missions m
  LEFT JOIN status s ON s.id = m.status_id
  LEFT JOIN norglider_missions nm ON nm.id = m.id`;

// The last mission that actually flew: launched, and not merely scheduled.
// "Last flown build" on the glider page is this mission's build.
async function fetchLastFlownMission(
	db: Db,
	gliderAssetId: number,
): Promise<BuildMissionRef | null> {
	const result = await db.query(
		`${MISSION_REF_SELECT}
     WHERE m.glider_asset_id = $1 AND m.launch_date IS NOT NULL
       AND COALESCE(s.name, '') <> ALL($2)
     ORDER BY m.launch_date DESC, m.id DESC
     LIMIT 1`,
		[gliderAssetId, PRE_LAUNCH_STATUSES],
	);
	return result.rows[0] ?? null;
}

// The mission being prepared: the earliest workshop/scheduled mission.
async function fetchNextMission(
	db: Db,
	gliderAssetId: number,
): Promise<BuildMissionRef | null> {
	const result = await db.query(
		`${MISSION_REF_SELECT}
     WHERE m.glider_asset_id = $1 AND s.name = ANY($2)
     ORDER BY m.launch_date ASC NULLS FIRST, m.id ASC
     LIMIT 1`,
		[gliderAssetId, PRE_LAUNCH_STATUSES],
	);
	return result.rows[0] ?? null;
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

type ModelLookup = Pick<
	GliderBuildComponent,
	"assetId" | "assetType" | "assetTypeGroup"
>;

async function fetchModels(
	pool: Pool,
	buildTree: ModelLookup[],
): Promise<Map<number, ModelInfo>> {
	const models = new Map<number, ModelInfo>();

	const sensorIds = buildTree
		.filter((c) => c.assetTypeGroup === "sensor")
		.map((c) => c.assetId);
	if (sensorIds.length) {
		const result = await pool.query(
			`SELECT asd.asset_id AS "assetId", t.label AS model, t.uri
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
		`SELECT asp.asset_id AS "assetId", t.label AS label, t.uri
     FROM asset_sensor_parameters asp
     JOIN nvs_terms t ON t.id = asp.p01_term_id
     WHERE asp.asset_id = ANY($1)
     ORDER BY t.label`,
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

		// Same certificate join as fetchComponentDetails/CalibrationsService
		// -- only cal tables with a service_event_id column (see
		// CAL_TABLES_WITH_SERVICE_EVENT) can link to an attached
		// certificate document at all.
		const hasServiceEvent = CAL_TABLES_WITH_SERVICE_EVENT.has(table);
		const documentJoin = hasServiceEvent
			? `LEFT JOIN LATERAL (
					SELECT id, file_reference FROM documents
					WHERE service_event_id = c.service_event_id
					AND file_reference ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-'
					ORDER BY created_at DESC LIMIT 1
				 ) doc ON true`
			: "";
		const documentSelect = hasServiceEvent
			? `, doc.id AS "documentId", doc.file_reference AS "documentFileReference"`
			: `, NULL::int AS "documentId", NULL AS "documentFileReference"`;

		const result = await pool.query(
			`SELECT DISTINCT ON (c.asset_id) c.*${documentSelect}
       FROM ${table} c
       ${documentJoin}
       WHERE c.asset_id = ANY($1) AND c.${dateColumn} <= $2
       ORDER BY c.asset_id, c.${dateColumn} DESC, c.id DESC`,
			[ids, asOfDate],
		);
		for (const row of result.rows) {
			const {
				id,
				asset_id,
				changed_by,
				created_at,
				service_event_id,
				documentId,
				documentFileReference,
				[dateColumn]: date,
				...coefficients
			} = row;
			byAsset.set(asset_id, {
				date,
				coefficients,
				documentId: documentId ?? null,
				documentName: documentFileReference
					? originalNameFromReference(documentFileReference)
					: null,
			});
		}
	}

	return byAsset;
}

// Science sensors with their parameters and the calibration in effect on
// `asOfDate` (not whatever they are calibrated to now -- an old mission shows
// the calibration that was actually in use on it).
async function buildSciencePayload(
	pool: Pool,
	components: GliderBuildComponent[],
	asOfDate: string,
): Promise<ScienceSensorRecord[]> {
	const sensors = components.filter((c) => c.assetTypeGroup === "sensor");
	const sensorIds = sensors.map((c) => c.assetId);
	const [measuredParameters, calibrations] = await Promise.all([
		fetchMeasuredParameters(pool, sensorIds),
		fetchCalibrationAsOf(pool, sensorIds, asOfDate),
	]);
	return sensors.map((c) => ({
		assetId: c.assetId,
		assetType: c.assetType,
		serialNumber: c.serialNumber,
		position: c.position,
		model: c.model,
		modelUri: c.modelUri,
		measuredParameters: measuredParameters.get(c.assetId) ?? [],
		calibration: calibrations.get(c.assetId) ?? null,
		asOfDate,
	}));
}

async function withModels(
	pool: Pool,
	raw: RawComponent[],
): Promise<GliderBuildComponent[]> {
	const models = await fetchModels(pool, raw);
	return raw.map((c) => {
		const info = models.get(c.assetId);
		return { ...c, model: info?.model ?? null, modelUri: info?.uri ?? null };
	});
}

const today = () => new Date().toISOString().slice(0, 10);

// Assets in this mission's build that another glider's OPEN mission (active,
// scheduled or workshop) also lists. A different glider's build can't
// physically hold the same sensor at the same time. Missions of the same
// glider are ignored on purpose: a workshop is seeded as a copy of the last
// build, so they share everything by design.
async function fetchBuildWarnings(
	db: Db,
	missionId: number,
): Promise<string[]> {
	const result = await db.query(
		`SELECT at.name AS "assetType", a.serial_number AS "serialNumber",
            agd.glider_name AS glider, om.mission_name AS "missionName",
            om.mission_number AS "missionNumber", os.name AS status
     FROM mission_build_items i
     JOIN missions m ON m.id = i.mission_id
     JOIN mission_build_items oi ON oi.asset_id = i.asset_id AND oi.mission_id <> i.mission_id
     JOIN missions om ON om.id = oi.mission_id
                     AND om.glider_asset_id IS DISTINCT FROM m.glider_asset_id
     JOIN status os ON os.id = om.status_id AND os.name IN ('active', 'scheduled', 'workshop')
     JOIN assets a ON a.id = i.asset_id
     JOIN asset_types at ON at.id = a.asset_type_id
     LEFT JOIN asset_glider_details agd ON agd.asset_id = om.glider_asset_id
     WHERE i.mission_id = $1
     ORDER BY at.name, a.serial_number`,
		[missionId],
	);
	return result.rows.map((r) =>
		`${r.assetType} ${r.serialNumber ?? ""} is also in the ${r.status} build of ${r.glider ?? "another glider"} (${r.missionNumber != null ? `mission ${r.missionNumber}` : r.missionName}).`.replace(
			/\s+/g,
			" ",
		),
	);
}

// One mission's build for the mission page: components, science payload as
// of the launch date, and any overlap warnings.
export async function getMissionBuild(
	pool: Pool,
	missionId: number,
): Promise<MissionBuild> {
	const mission = await pool.query(
		`SELECT launch_date::date::text AS "launchDate" FROM missions WHERE id = $1`,
		[missionId],
	);
	if (mission.rows.length === 0) {
		throw new NotFoundException(`Mission ${missionId} not found`);
	}
	const raw = await fetchMissionTree(pool, missionId);
	const components = await withModels(pool, raw);
	const [sciencePayload, warnings] = await Promise.all([
		buildSciencePayload(
			pool,
			components,
			mission.rows[0].launchDate ?? today(),
		),
		fetchBuildWarnings(pool, missionId),
	]);
	return { recorded: raw.length > 0, components, sciencePayload, warnings };
}

// Full detail-table row + full cal history per component, for the
// Current Build table's row expansion — this is the generic version of
// fetchModels/fetchSciencePayload above (which only pull curated fields
// for display elsewhere), covering every asset type with a detail or cal
// table, not just science sensors.
async function fetchComponentDetails(
	pool: Pool,
	buildTree: ModelLookup[],
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
					// glider_asset_id (asset_slocum_aft_section_details) is the
					// core-section identity link, not a spec field -- it's
					// already expressed by the row sitting under this glider.
					const { asset_id, glider_asset_id, ...fields } = result.rows[0];
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
				const documentJoin = CAL_TABLES_WITH_SERVICE_EVENT.has(table)
					? `LEFT JOIN LATERAL (
							SELECT id, file_reference FROM documents
							WHERE service_event_id = c.service_event_id
							AND file_reference ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-'
							ORDER BY created_at DESC LIMIT 1
						 ) doc ON true`
					: "";
				const documentSelect = CAL_TABLES_WITH_SERVICE_EVENT.has(table)
					? `, doc.id AS "documentId", doc.file_reference AS "documentFileReference"`
					: `, NULL::int AS "documentId", NULL AS "documentFileReference"`;
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
						documentFileReference,
						[dateColumn]: date,
						...coefficients
					} = row;
					return {
						date,
						coefficients,
						documentId: documentId ?? null,
						documentName: documentFileReference
							? originalNameFromReference(documentFileReference)
							: null,
					};
				});
			}

			// Same shape as RmasService.getForAsset -- this file talks to
			// pool directly rather than injecting RmasService (a plain
			// helper module, not a Nest provider), so the query is
			// duplicated here rather than shared. Lets a glider's own
			// Timeline tab show an RMA that's actually against one of its
			// *components* (e.g. a hull section currently built into it),
			// not just the glider's own asset row.
			const rmaResult = await pool.query(
				`SELECT r.id AS "rmaId", r.rma_number AS "rmaNumber", ra.reason,
                r.opened_date AS "openedDate",
                COALESCE(crs.current_stage, 'opened') AS "currentStage",
                CASE WHEN crs.current_stage = 'closed' THEN crs.event_date END AS "closedDate",
                COALESCE(crs.current_stage, 'opened') <> 'closed' AS open
         FROM rma_assets ra
         JOIN rmas r ON r.id = ra.rma_id
         LEFT JOIN current_rma_status crs ON crs.rma_id = r.id
         WHERE ra.asset_id = $1
         ORDER BY r.opened_date DESC, r.id DESC`,
				[c.assetId],
			);
			const rmas: GliderComponentDetail["rmas"] =
				rmaResult.rows.length > 0 ? rmaResult.rows : null;

			return { assetId: c.assetId, detail, calibrations, rmas };
		}),
	);
	return results.filter(
		(r) => r.detail !== null || r.calibrations !== null || r.rmas !== null,
	);
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
	buildTree: ModelLookup[],
	statusHistory: GliderStatusHistoryItem[],
): Promise<GliderEditHistoryItem[]> {
	const allAssetIds = [gliderAssetId, ...buildTree.map((c) => c.assetId)];
	const buildItemIds: number[] = (
		await pool.query(
			`SELECT i.id FROM mission_build_items i
       JOIN missions m ON m.id = i.mission_id
       WHERE m.glider_asset_id = $1`,
			[gliderAssetId],
		)
	).rows.map((r) => r.id);

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
		{
			// Every build change on any of this glider's missions.
			table: "mission_build_items",
			ids: buildItemIds,
		},
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
       AND nm.status IS DISTINCT FROM 'workshop'
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
     WHERE glider_asset_id = $1
       AND COALESCE((SELECT name FROM status WHERE id = status_id), '') <> 'workshop'`,
		[gliderAssetId],
	);
	return result.rows[0];
}

// The glider page: a read-only view of the last flown mission's build, plus
// pointers to that mission and to the one being prepared. Builds are edited
// on their mission, never here.
export async function getGliderBuild(
	pool: Pool,
	gliderAssetId: number,
): Promise<GliderBuild> {
	const [buildMission, nextMission] = await Promise.all([
		fetchLastFlownMission(pool, gliderAssetId),
		fetchNextMission(pool, gliderAssetId),
	]);
	const rawBuildTree = buildMission
		? await fetchMissionTree(pool, buildMission.id)
		: [];
	const allAssetIds = [gliderAssetId, ...rawBuildTree.map((c) => c.assetId)];

	const [
		statusHistory,
		buildTree,
		componentDetails,
		deployments,
		missionsSummary,
	] = await Promise.all([
		fetchStatusHistory(pool, allAssetIds),
		withModels(pool, rawBuildTree),
		fetchComponentDetails(pool, rawBuildTree),
		fetchDeployments(pool, gliderAssetId),
		fetchMissionsSummary(pool, gliderAssetId),
	]);
	// Calibration as of today: this panel shows each sensor's current
	// calibration, where a mission's own page shows the one at its launch.
	const sciencePayload = await buildSciencePayload(pool, buildTree, today());
	const editHistory = await fetchEditHistory(
		pool,
		gliderAssetId,
		buildTree,
		statusHistory,
	);

	return {
		components: buildTree,
		componentDetails,
		sciencePayload,
		buildMission,
		nextMission,
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

// Allowed positions, for the asset types where the position means something
// (the glider diagram places hulls, batteries and sensors by it).
//
// REQUIRED: must be given when the part is added (a hull or battery with no
// position can't be drawn). "pitch" is deliberately not here: it names a
// battery *model*, never a location.
//
// OPTIONAL: may be left empty (a Slocum's CT sensor has no location), but if
// given it must be one of these. Where a sensor sits on a Seaglider is the
// user's choice: the upper or lower hatch, either side, or the centre line.
//
// Keep in step with dashboard/src/lib/asset-positions.ts -- @ogdb/types is
// types-only at runtime, so the lists can't be shared from there.
const ASSET_POSITIONS: Record<string, readonly string[]> = {
	slocum_hull: ["fore", "energy", "aft"],
	battery: ["fore", "energy", "aft"],
};

const SENSOR_POSITIONS = [
	"upper hatch",
	"lower hatch",
	"starboard",
	"port",
	"centre",
] as const;

const OPTIONAL_POSITIONS: Record<string, readonly string[]> = {
	ct_sensor: SENSOR_POSITIONS,
	do_sensor: SENSOR_POSITIONS,
	eco_sensor: SENSOR_POSITIONS,
};

async function assertValidPosition(
	client: PoolClient,
	childAssetId: number,
	position: string | null,
	// "add" must choose a position where one is required; "replace" inherits
	// the old row's, and older rows may have none or a free-text one (left
	// alone); "set" is an explicit move, so it is always checked.
	mode: "add" | "replace" | "set",
): Promise<void> {
	const type = await client.query(
		`SELECT at.name FROM assets a
       JOIN asset_types at ON at.id = a.asset_type_id
      WHERE a.id = $1`,
		[childAssetId],
	);
	const assetType: string | undefined = type.rows[0]?.name;
	if (!assetType) return;

	const required = ASSET_POSITIONS[assetType];
	const optional = OPTIONAL_POSITIONS[assetType];
	const allowed = required ?? optional;
	if (!allowed) return;

	if (position === null) {
		// Required types can't be added without one, nor have it cleared later.
		if (required && mode !== "replace") {
			throw new BadRequestException(
				`A ${assetType} needs a position: ${required.join(", ")}.`,
			);
		}
		return;
	}
	// An inherited position (replace) is not re-validated -- only what the
	// user is choosing now.
	if (mode === "replace") return;
	if (!allowed.includes(position)) {
		throw new BadRequestException(
			`"${position}" is not a valid position for a ${assetType}; use ${allowed.join(", ")}.`,
		);
	}
}

// What an editor save needs to know about the mission it is editing.
interface MissionForBuild {
	id: number;
	gliderAssetId: number | null;
	status: string | null;
}

async function fetchMissionForBuild(
	client: PoolClient,
	missionId: number,
): Promise<MissionForBuild> {
	const result = await client.query(
		`SELECT m.id, m.glider_asset_id AS "gliderAssetId", s.name AS status
     FROM missions m LEFT JOIN status s ON s.id = m.status_id
     WHERE m.id = $1`,
		[missionId],
	);
	if (result.rows.length === 0) {
		throw new NotFoundException(`Mission ${missionId} not found`);
	}
	if (result.rows[0].gliderAssetId === null) {
		throw new BadRequestException(
			"This mission has no glider, so it has no build to edit.",
		);
	}
	return result.rows[0];
}

async function assetTypeName(
	client: PoolClient,
	assetId: number,
): Promise<string | null> {
	const result = await client.query(
		`SELECT at.name FROM assets a JOIN asset_types at ON at.id = a.asset_type_id
     WHERE a.id = $1`,
		[assetId],
	);
	return result.rows[0]?.name ?? null;
}

// The Slocum aft section is the glider's identity (a 1:1 link), seeded into
// every build. It is never added, replaced or removed by hand.
const CORE_TYPE = "slocum_aft_section";

// Two ACTIVE builds claiming one asset is a physical impossibility, so it is
// refused. Planned (workshop/scheduled) overlaps only warn -- see
// fetchBuildWarnings.
async function assertNotInOtherActiveBuild(
	client: PoolClient,
	mission: MissionForBuild,
	assetId: number,
): Promise<void> {
	if (mission.status !== "active") return;
	const result = await client.query(
		`SELECT om.mission_name AS "missionName", om.mission_number AS "missionNumber",
            agd.glider_name AS glider
     FROM mission_build_items oi
     JOIN missions om ON om.id = oi.mission_id
     JOIN status os ON os.id = om.status_id AND os.name = 'active'
     LEFT JOIN asset_glider_details agd ON agd.asset_id = om.glider_asset_id
     WHERE oi.asset_id = $1 AND oi.mission_id <> $2
       AND om.glider_asset_id IS DISTINCT FROM $3
     LIMIT 1`,
		[assetId, mission.id, mission.gliderAssetId],
	);
	if (result.rows.length > 0) {
		const o = result.rows[0];
		throw new ConflictException(
			`That asset is already in the build of the active mission ${o.missionNumber ?? o.missionName} (${o.glider ?? "another glider"}).`,
		);
	}
}

// Applies a batch of BuildChange entries to ONE mission's build inside an
// already-open transaction -- the caller owns BEGIN/COMMIT/ROLLBACK. A
// mission's build has no dates, so nothing here can touch another mission
// or the glider's history: that separation is the point of
// mission_build_items.
export async function applyMissionBuildChangesTx(
	client: PoolClient,
	missionId: number,
	changes: BuildChange[],
	notes: string | null | undefined,
	userId: number,
): Promise<void> {
	const mission = await fetchMissionForBuild(client, missionId);
	const gliderAssetId = mission.gliderAssetId as number;

	for (const change of changes) {
		if (change.action === "replace") {
			const old = await client.query(
				`SELECT i.parent_item_id, i."position", i.asset_id, p.asset_id AS parent_asset_id
         FROM mission_build_items i
         LEFT JOIN mission_build_items p ON p.id = i.parent_item_id
         WHERE i.id = $1 AND i.mission_id = $2 FOR UPDATE OF i`,
				[change.itemId, missionId],
			);
			if (old.rows.length === 0) {
				throw new ConflictException(
					`Build item ${change.itemId} is not in this mission's build -- it may have already been changed.`,
				);
			}
			const { position, asset_id: oldAssetId } = old.rows[0];
			const parentAssetId = old.rows[0].parent_asset_id ?? gliderAssetId;
			if ((await assetTypeName(client, oldAssetId)) === CORE_TYPE) {
				throw new BadRequestException(
					"The aft section is the glider itself and can't be replaced here.",
				);
			}
			const childAssetId = await resolveOrCreateAsset(
				client,
				userId,
				change.childAssetId,
				change.newAsset,
			);
			await assertValidParent(client, childAssetId, parentAssetId);
			await assertValidPosition(client, childAssetId, position, "replace");
			await assertNotInOtherActiveBuild(client, mission, childAssetId);
			try {
				// In place: the item keeps its position and whatever is mounted
				// in it (e.g. sensors in a replaced payload bay).
				await client.query(
					`UPDATE mission_build_items
           SET asset_id = $1, notes = COALESCE($2, notes), changed_by = $3, updated_at = now()
           WHERE id = $4`,
					[childAssetId, notes ?? null, userId, change.itemId],
				);
			} catch (err) {
				throw mapDuplicateItem(err);
			}
		} else if (change.action === "remove") {
			const old = await client.query(
				`SELECT asset_id FROM mission_build_items
         WHERE id = $1 AND mission_id = $2 FOR UPDATE`,
				[change.itemId, missionId],
			);
			if (old.rows.length === 0) {
				throw new ConflictException(
					`Build item ${change.itemId} is not in this mission's build -- it may have already been changed.`,
				);
			}
			if ((await assetTypeName(client, old.rows[0].asset_id)) === CORE_TYPE) {
				throw new BadRequestException(
					"The aft section is the glider itself and can't be removed here.",
				);
			}
			// ON DELETE CASCADE takes whatever was mounted in it too.
			await client.query("DELETE FROM mission_build_items WHERE id = $1", [
				change.itemId,
			]);
			if (change.newStatusId) {
				await client.query(
					"INSERT INTO asset_status_history (asset_id, status_id, effective_date, notes, changed_by) VALUES ($1, $2, CURRENT_DATE, $3, $4)",
					[
						old.rows[0].asset_id,
						change.newStatusId,
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
			if ((await assetTypeName(client, childAssetId)) === CORE_TYPE) {
				throw new BadRequestException(
					"The aft section is the glider itself and can't be added here.",
				);
			}
			let parentItemId: number | null = null;
			if (change.parentAssetId !== gliderAssetId) {
				const parent = await client.query(
					"SELECT id FROM mission_build_items WHERE mission_id = $1 AND asset_id = $2",
					[missionId, change.parentAssetId],
				);
				if (parent.rows.length === 0) {
					throw new ConflictException(
						"The part it is mounted in is not in this mission's build.",
					);
				}
				parentItemId = parent.rows[0].id;
			}
			await assertValidParent(client, childAssetId, change.parentAssetId);
			await assertValidPosition(
				client,
				childAssetId,
				change.position ?? null,
				"add",
			);
			await assertNotInOtherActiveBuild(client, mission, childAssetId);
			try {
				await client.query(
					`INSERT INTO mission_build_items
             (mission_id, asset_id, parent_item_id, "position", notes, changed_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
					[
						missionId,
						childAssetId,
						parentItemId,
						change.position ?? null,
						notes ?? null,
						userId,
					],
				);
			} catch (err) {
				throw mapDuplicateItem(err);
			}
		} else if (change.action === "setPosition") {
			const item = await client.query(
				`SELECT asset_id FROM mission_build_items
         WHERE id = $1 AND mission_id = $2 FOR UPDATE`,
				[change.itemId, missionId],
			);
			if (item.rows.length === 0) {
				throw new ConflictException(
					`Build item ${change.itemId} is not in this mission's build -- it may have already been changed.`,
				);
			}
			const position = change.position?.trim() || null;
			await assertValidPosition(client, item.rows[0].asset_id, position, "set");
			await client.query(
				`UPDATE mission_build_items
         SET "position" = $1, changed_by = $2, updated_at = now()
         WHERE id = $3`,
				[position, userId, change.itemId],
			);
		} else {
			throw new BadRequestException(
				`Unknown change action: ${JSON.stringify(change)}`,
			);
		}
	}
}

function mapDuplicateItem(err: unknown): Error {
	if (
		err &&
		typeof err === "object" &&
		"code" in err &&
		(err as { code: string }).code === "23505"
	) {
		return new ConflictException("That asset is already in this build.");
	}
	return err instanceof Error ? err : new Error(String(err));
}

// Warnings after a save -- same list the mission page shows persistently.
export async function getBuildWarnings(
	pool: Pool,
	missionId: number,
): Promise<string[]> {
	return fetchBuildWarnings(pool, missionId);
}

// Replaces `toMissionId`'s build with a copy of `fromMissionId`'s. Parents
// are inserted before their children so parent_item_id can be remapped.
export async function copyMissionBuildTx(
	client: PoolClient,
	fromMissionId: number,
	toMissionId: number,
	userId: number,
): Promise<number> {
	if (fromMissionId === toMissionId) {
		throw new BadRequestException("A mission can't copy its own build.");
	}
	const source = await client.query(
		`SELECT id, asset_id, parent_item_id, "position"
     FROM mission_build_items WHERE mission_id = $1`,
		[fromMissionId],
	);
	await client.query("DELETE FROM mission_build_items WHERE mission_id = $1", [
		toMissionId,
	]);
	const newIdByOld = new Map<number, number>();
	let remaining = source.rows;
	while (remaining.length > 0) {
		const ready = remaining.filter(
			(r) => r.parent_item_id === null || newIdByOld.has(r.parent_item_id),
		);
		if (ready.length === 0) break; // unreachable given the composite FK
		for (const r of ready) {
			const inserted = await client.query(
				`INSERT INTO mission_build_items
           (mission_id, asset_id, parent_item_id, "position", notes, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
				[
					toMissionId,
					r.asset_id,
					r.parent_item_id === null ? null : newIdByOld.get(r.parent_item_id),
					r.position,
					`copied from mission id ${fromMissionId}`,
					userId,
				],
			);
			newIdByOld.set(r.id, inserted.rows[0].id);
		}
		remaining = remaining.filter((r) => !newIdByOld.has(r.id));
	}
	return newIdByOld.size;
}

// A new mission's starting build: a copy of the last flown build of the same
// glider (the physical glider is what it was when it came back), or -- for a
// glider that has not flown with a recorded build -- just its aft section.
export async function seedMissionBuildTx(
	client: PoolClient,
	missionId: number,
	gliderAssetId: number,
	userId: number,
): Promise<void> {
	const source = await client.query(
		`SELECT m.id FROM missions m
     LEFT JOIN status s ON s.id = m.status_id
     WHERE m.glider_asset_id = $1 AND m.id <> $2 AND m.launch_date IS NOT NULL
       AND COALESCE(s.name, '') <> ALL($3)
       AND EXISTS (SELECT 1 FROM mission_build_items i WHERE i.mission_id = m.id)
     ORDER BY m.launch_date DESC, m.id DESC
     LIMIT 1`,
		[gliderAssetId, missionId, PRE_LAUNCH_STATUSES],
	);
	if (source.rows.length > 0) {
		await copyMissionBuildTx(client, source.rows[0].id, missionId, userId);
		return;
	}
	await client.query(
		`INSERT INTO mission_build_items (mission_id, asset_id, changed_by)
     SELECT $1, aft.asset_id, $3
     FROM asset_slocum_aft_section_details aft
     WHERE aft.glider_asset_id = $2`,
		[missionId, gliderAssetId, userId],
	);
}

// The next permanent mission number: highest in use + 1, under an advisory
// lock so two simultaneous activations can't draw the same one. (The UNIQUE
// constraint would catch a clash, but as an error, not a retry.)
export async function nextMissionNumberTx(client: PoolClient): Promise<number> {
	await client.query(
		"SELECT pg_advisory_xact_lock(hashtext('mission_number'))",
	);
	const result = await client.query(
		"SELECT COALESCE(MAX(mission_number), 0) + 1 AS next FROM missions",
	);
	return Number(result.rows[0].next);
}
