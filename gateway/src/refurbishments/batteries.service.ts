import {
	BadRequestException,
	HttpException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	BuildChange,
	RefurbBatteries,
	RefurbBatteryCandidate,
	RefurbBatteryChecks,
	RefurbBatteryPack,
} from "@ogdb/types";
import type { Pool, PoolClient } from "pg";
import { PG_POOL } from "../db/db.constants";
import { applyMissionBuildChangesTx } from "../gliders/build.helpers";
import { coerce } from "./field-coerce";

// Physical battery slots counted from the nose. Mirrors the portal's
// asset-positions.ts: a Seaglider has fore (Secondary) and aft (Primary); an
// SGX adds a middle slot.
const SEAGLIDER_SLOTS = ["fore", "aft"];
const SGX_SLOTS = ["fore", "middle", "aft"];

// What each slot is called on this platform. Mirrors batteryPositionLabel in
// the portal's asset-positions.ts (and positionLabelFor in build.helpers.ts).
const SEAGLIDER_LABELS: Record<string, string> = {
	fore: "Secondary",
	aft: "Primary",
};
const SGX_LABELS: Record<string, string> = {
	fore: "Secondary",
	middle: "Primary",
	aft: "Aft",
};

// 3 % of capacity lost per year of age, the figure the paper logsheet used.
const DERATING_PER_YEAR = 0.03;
const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

const PACK_FIELDS = [
	["installedAssetId", "installed_asset_id", "int"],
	["installedOn", "installed_on", "date"],
	["installedWeightG", "installed_weight_g", "num"],
	["installedVoltageV", "installed_voltage_v", "num"],
	["removedWeightG", "removed_weight_g", "num"],
	["removedVoltageV", "removed_voltage_v", "num"],
	["notes", "notes", "text"],
] as const;

const personName = (alias: string) =>
	`NULLIF(TRIM(${alias}.first_name || ' ' || ${alias}.last_name), '')`;

function mapDbError(err: unknown): never {
	if (err instanceof HttpException) throw err;
	const e = err as { code?: string; constraint?: string };
	if (e.code === "23514") {
		throw new BadRequestException(
			`A value is out of range (${e.constraint ?? "check failed"}). Weights are in grams (a primary pack is about 9700 g) and voltages in volts.`,
		);
	}
	if (e.code === "22003") {
		throw new BadRequestException("A number is too large for its field.");
	}
	throw err;
}

interface GliderInfo {
	gliderAssetId: number;
	platformId: number | null;
	slots: string[];
}

@Injectable()
export class BatteriesService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	private async refurbishment(missionId: number): Promise<{
		id: number;
		glider: GliderInfo;
	}> {
		const r = await this.pool.query(
			`SELECT r.id, m.glider_asset_id AS "gliderAssetId",
              agd.platform_id AS "platformId", p.model AS "platformModel"
         FROM refurbishments r
         JOIN missions m ON m.id = r.mission_id
         LEFT JOIN asset_glider_details agd ON agd.asset_id = m.glider_asset_id
         LEFT JOIN platforms p ON p.id = agd.platform_id
        WHERE r.mission_id = $1`,
			[missionId],
		);
		const row = r.rows[0];
		if (!row) {
			throw new NotFoundException(
				`Mission ${missionId} has no refurbishment logsheet.`,
			);
		}
		const sgx =
			String(row.platformModel ?? "")
				.trim()
				.toUpperCase() === "SGX";
		return {
			id: row.id,
			glider: {
				gliderAssetId: row.gliderAssetId,
				platformId: row.platformId,
				slots: sgx ? SGX_SLOTS : SEAGLIDER_SLOTS,
			},
		};
	}

	// Batteries the tech can pick: battery assets whose model is for this
	// glider's platform.
	private async candidates(
		db: Pool | PoolClient,
		platformId: number | null,
	): Promise<RefurbBatteryCandidate[]> {
		const r = await db.query(
			`SELECT a.id, a.serial_number AS "serialNumber", bm.model,
              to_char(bd.date_of_manufacture, 'YYYY-MM-DD') AS "dateOfManufacture",
              bm.nominal_capacity::float8 AS "capacityAh",
              bm.nominal_voltage::float8 AS "nominalVoltage"
         FROM assets a
         JOIN asset_battery_details bd ON bd.asset_id = a.id
         JOIN battery_models bm ON bm.id = bd.battery_model_id
        WHERE bm.platform_id IS NOT DISTINCT FROM $1
        ORDER BY bm.nominal_voltage DESC, a.serial_number, a.id`,
			[platformId],
		);
		return r.rows;
	}

	private async assetsById(
		db: Pool | PoolClient,
		ids: number[],
	): Promise<RefurbBatteryCandidate[]> {
		if (ids.length === 0) return [];
		const r = await db.query(
			`SELECT a.id, a.serial_number AS "serialNumber", bm.model,
              to_char(bd.date_of_manufacture, 'YYYY-MM-DD') AS "dateOfManufacture",
              bm.nominal_capacity::float8 AS "capacityAh",
              bm.nominal_voltage::float8 AS "nominalVoltage"
         FROM assets a
         LEFT JOIN asset_battery_details bd ON bd.asset_id = a.id
         LEFT JOIN battery_models bm ON bm.id = bd.battery_model_id
        WHERE a.id = ANY($1)`,
			[ids],
		);
		return r.rows;
	}

	// The battery in each slot of the mission's build (mounted on the glider).
	private async buildBatteries(
		db: Pool | PoolClient,
		missionId: number,
	): Promise<Map<string, { itemId: number; assetId: number }>> {
		const r = await db.query(
			`SELECT i.id AS "itemId", i.asset_id AS "assetId", i."position"
         FROM mission_build_items i
         JOIN assets a ON a.id = i.asset_id
         JOIN asset_types t ON t.id = a.asset_type_id
        WHERE i.mission_id = $1 AND t.name = 'battery' AND i.parent_item_id IS NULL`,
			[missionId],
		);
		return new Map(
			r.rows.map((x) => [x.position, { itemId: x.itemId, assetId: x.assetId }]),
		);
	}

	async get(missionId: number): Promise<RefurbBatteries> {
		const { id, glider } = await this.refurbishment(missionId);
		const [rows, build, checksRow, candidates] = await Promise.all([
			this.pool.query(
				`SELECT c.*, to_char(c.installed_on, 'YYYY-MM-DD') AS installed_on_s,
                ${personName("uc")} AS updated_by_name
           FROM refurb_battery_changes c
           LEFT JOIN users uu ON uu.id = c.updated_by
           LEFT JOIN contacts uc ON uc.id = uu.contact_id
          WHERE c.refurbishment_id = $1`,
				[id],
			),
			this.buildBatteries(this.pool, missionId),
			this.pool.query(
				`SELECT k.fuel_gauges_reset, k.ah0_updated, k.gps_cell_replaced,
                to_char(k.gps_cell_manufactured, 'YYYY-MM-DD') AS gps_cell_manufactured,
                k.updated_at, ${personName("uc")} AS updated_by_name
           FROM refurb_battery_checks k
           LEFT JOIN users uu ON uu.id = k.updated_by
           LEFT JOIN contacts uc ON uc.id = uu.contact_id
          WHERE k.refurbishment_id = $1`,
				[id],
			),
			this.candidates(this.pool, glider.platformId),
		]);

		const num = (v: unknown) =>
			v === null || v === undefined ? null : Number(v);
		const bySlot = new Map(rows.rows.map((r) => [r.position, r]));
		const packs: RefurbBatteryPack[] = glider.slots.map((position) => {
			const r = bySlot.get(position);
			return {
				position,
				buildAssetId: build.get(position)?.assetId ?? null,
				// Before the first save, the pack to be removed is whatever the
				// build holds in the slot.
				removedAssetId: r
					? r.removed_asset_id
					: (build.get(position)?.assetId ?? null),
				installedAssetId: r?.installed_asset_id ?? null,
				installedOn: r?.installed_on_s ?? null,
				installedWeightG: num(r?.installed_weight_g),
				installedVoltageV: num(r?.installed_voltage_v),
				removedWeightG: num(r?.removed_weight_g),
				removedVoltageV: num(r?.removed_voltage_v),
				notes: r?.notes ?? null,
				derating: num(r?.derating),
				remaining: num(r?.remaining),
				fuelGaugeAh: num(r?.fuel_gauge_ah),
				saved: Boolean(r),
				updatedAt: r?.updated_at ?? null,
				updatedByName: r?.updated_by_name ?? null,
			};
		});

		const k = checksRow.rows[0];
		const checks: RefurbBatteryChecks = {
			fuelGaugesReset: k?.fuel_gauges_reset ?? false,
			ah0Updated: k?.ah0_updated ?? false,
			gpsCellReplaced: k?.gps_cell_replaced ?? null,
			gpsCellManufactured: k?.gps_cell_manufactured ?? null,
			updatedAt: k?.updated_at ?? null,
			updatedByName: k?.updated_by_name ?? null,
		};

		const named = [
			...new Set(
				packs.flatMap((p) =>
					[p.buildAssetId, p.removedAssetId, p.installedAssetId].filter(
						(x): x is number => x !== null,
					),
				),
			),
		];
		return {
			packs,
			candidates,
			assets: await this.assetsById(this.pool, named),
			checks,
		};
	}

	// Saves one slot. If a different battery is chosen than the mission's
	// build holds, the build is changed in the same transaction (replace, or
	// add if the slot was empty), so the logsheet and the build cannot
	// disagree. Derating, remaining capacity and the fuel-gauge value are
	// calculated here, once, from the install date.
	async savePack(
		missionId: number,
		position: string,
		input: Record<string, unknown>,
		userId: number,
	): Promise<RefurbBatteries> {
		const { id, glider } = await this.refurbishment(missionId);
		if (!glider.slots.includes(position)) {
			throw new BadRequestException(
				`This glider has no "${position}" battery slot.`,
			);
		}
		const known = new Set<string>(PACK_FIELDS.map(([k]) => k));
		for (const k of Object.keys(input)) {
			if (!known.has(k)) throw new BadRequestException(`Unknown field "${k}".`);
		}
		const v: Record<string, unknown> = {};
		for (const [key, , kind] of PACK_FIELDS) {
			v[key] = coerce(key, kind, input[key]);
		}
		const installedAssetId = v.installedAssetId as number | null;

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			await client.query(
				"SELECT 1 FROM refurbishments WHERE id = $1 FOR UPDATE",
				[id],
			);

			if (installedAssetId !== null) {
				const ok = await this.candidates(client, glider.platformId);
				if (!ok.some((c) => c.id === installedAssetId)) {
					throw new BadRequestException(
						"That battery is not a model for this glider's platform.",
					);
				}
			}

			const existing = await client.query(
				"SELECT * FROM refurb_battery_changes WHERE refurbishment_id = $1 AND position = $2 FOR UPDATE",
				[id, position],
			);
			const prev = existing.rows[0];
			const build = (await this.buildBatteries(client, missionId)).get(
				position,
			);

			// The pack being removed is fixed the first time the slot is saved.
			const removedAssetId: number | null = prev
				? prev.removed_asset_id
				: (build?.assetId ?? null);

			// Keep the mission's build in step with the choice.
			if (installedAssetId !== null && build?.assetId !== installedAssetId) {
				const change: BuildChange = build
					? {
							action: "replace",
							itemId: build.itemId,
							childAssetId: installedAssetId,
						}
					: {
							action: "add",
							parentAssetId: glider.gliderAssetId,
							childAssetId: installedAssetId,
							position,
						};
				await applyMissionBuildChangesTx(
					client,
					missionId,
					[change],
					`Refurbishment logsheet: ${position} battery`,
					userId,
				);
			}

			// Derating, remaining and fuel gauge, from the install date.
			let derating: number | null = null;
			let remaining: number | null = null;
			let fuelGaugeAh: number | null = null;
			if (installedAssetId !== null && v.installedOn) {
				const [asset] = await this.assetsById(client, [installedAssetId]);
				if (asset?.dateOfManufacture) {
					const years =
						(Date.parse(v.installedOn as string) -
							Date.parse(asset.dateOfManufacture)) /
						MS_PER_YEAR;
					derating = Math.min(1, Math.max(0, years * DERATING_PER_YEAR));
					derating = Math.round(derating * 10000) / 10000;
					remaining = Math.round((1 - derating) * 10000) / 10000;
					if (asset.capacityAh !== null) {
						fuelGaugeAh = Math.round(asset.capacityAh * remaining * 10) / 10;
					}
				}
			}

			// The weight and voltage belong to each battery's own history too.
			const measuredDate = (v.installedOn as string | null) ?? null;
			const installedMeasurementId = await this.writeMeasurement(client, {
				measurementId: prev?.installed_measurement_id ?? null,
				assetId: installedAssetId,
				measuredDate,
				voltage: v.installedVoltageV as number | null,
				weight: v.installedWeightG as number | null,
				derating,
				remaining,
				userId,
				refurbId: id,
				what: "installed",
			});
			const removedMeasurementId = await this.writeMeasurement(client, {
				measurementId: prev?.removed_measurement_id ?? null,
				// A pack that is kept has only the one (installed) reading.
				assetId: removedAssetId !== installedAssetId ? removedAssetId : null,
				measuredDate,
				voltage: v.removedVoltageV as number | null,
				weight: v.removedWeightG as number | null,
				derating: null,
				remaining: null,
				userId,
				refurbId: id,
				what: "removed",
			});

			await client.query(
				`INSERT INTO refurb_battery_changes
           (refurbishment_id, position, removed_asset_id, installed_asset_id,
            installed_on, installed_weight_g, installed_voltage_v,
            removed_weight_g, removed_voltage_v, notes,
            derating, remaining, fuel_gauge_ah,
            installed_measurement_id, removed_measurement_id,
            created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16)
         ON CONFLICT (refurbishment_id, position) DO UPDATE SET
            installed_asset_id = EXCLUDED.installed_asset_id,
            installed_on = EXCLUDED.installed_on,
            installed_weight_g = EXCLUDED.installed_weight_g,
            installed_voltage_v = EXCLUDED.installed_voltage_v,
            removed_weight_g = EXCLUDED.removed_weight_g,
            removed_voltage_v = EXCLUDED.removed_voltage_v,
            notes = EXCLUDED.notes,
            derating = EXCLUDED.derating,
            remaining = EXCLUDED.remaining,
            fuel_gauge_ah = EXCLUDED.fuel_gauge_ah,
            installed_measurement_id = EXCLUDED.installed_measurement_id,
            removed_measurement_id = EXCLUDED.removed_measurement_id,
            updated_by = EXCLUDED.updated_by,
            updated_at = now()`,
				[
					id,
					position,
					removedAssetId,
					installedAssetId,
					v.installedOn,
					v.installedWeightG,
					v.installedVoltageV,
					v.removedWeightG,
					v.removedVoltageV,
					v.notes,
					derating,
					remaining,
					fuelGaugeAh,
					installedMeasurementId,
					removedMeasurementId,
					userId,
				],
			);
			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			return mapDbError(err);
		} finally {
			client.release();
		}
		return this.get(missionId);
	}

	// Writes (or updates) the battery's own measurement row for this
	// refurbishment. Returns the row id to remember, or null when there is
	// nothing to record.
	private async writeMeasurement(
		client: PoolClient,
		m: {
			measurementId: number | null;
			assetId: number | null;
			measuredDate: string | null;
			voltage: number | null;
			weight: number | null;
			derating: number | null;
			remaining: number | null;
			userId: number;
			refurbId: number;
			what: "installed" | "removed";
		},
	): Promise<number | null> {
		const nothing =
			m.assetId === null || (m.voltage === null && m.weight === null);
		if (nothing) {
			if (m.measurementId !== null) {
				await client.query(
					"DELETE FROM asset_battery_measurements WHERE id = $1",
					[m.measurementId],
				);
			}
			return null;
		}
		const note = `Refurbishment ${m.refurbId}: ${m.what}`;
		if (m.measurementId !== null) {
			await client.query(
				`UPDATE asset_battery_measurements
            SET asset_id = $2, measured_date = COALESCE($3::date, CURRENT_DATE),
                voltage = $4, weight = $5, age_derating = $6,
                remaining_capacity = $7, notes = $8, changed_by = $9
          WHERE id = $1`,
				[
					m.measurementId,
					m.assetId,
					m.measuredDate,
					m.voltage,
					m.weight,
					m.derating,
					m.remaining,
					note,
					m.userId,
				],
			);
			return m.measurementId;
		}
		const r = await client.query(
			`INSERT INTO asset_battery_measurements
         (asset_id, measured_date, voltage, weight, age_derating, remaining_capacity, notes, changed_by)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7, $8)
       RETURNING id`,
			[
				m.assetId,
				m.measuredDate,
				m.voltage,
				m.weight,
				m.derating,
				m.remaining,
				note,
				m.userId,
			],
		);
		return r.rows[0].id;
	}

	async saveChecks(
		missionId: number,
		input: Record<string, unknown>,
		userId: number,
	): Promise<RefurbBatteries> {
		const { id } = await this.refurbishment(missionId);
		const fields = [
			["fuelGaugesReset", "fuel_gauges_reset", "bool"],
			["ah0Updated", "ah0_updated", "bool"],
			["gpsCellReplaced", "gps_cell_replaced", "bool"],
			["gpsCellManufactured", "gps_cell_manufactured", "date"],
		] as const;
		for (const k of Object.keys(input)) {
			if (!fields.some(([key]) => key === k)) {
				throw new BadRequestException(`Unknown field "${k}".`);
			}
		}
		const vals = fields.map(([key, , kind]) => coerce(key, kind, input[key]));
		await this.pool.query(
			`INSERT INTO refurb_battery_checks
         (refurbishment_id, fuel_gauges_reset, ah0_updated, gps_cell_replaced,
          gps_cell_manufactured, updated_by)
       VALUES ($1, COALESCE($2, false), COALESCE($3, false), $4, $5, $6)
       ON CONFLICT (refurbishment_id) DO UPDATE SET
          fuel_gauges_reset = EXCLUDED.fuel_gauges_reset,
          ah0_updated = EXCLUDED.ah0_updated,
          gps_cell_replaced = EXCLUDED.gps_cell_replaced,
          gps_cell_manufactured = EXCLUDED.gps_cell_manufactured,
          updated_by = EXCLUDED.updated_by,
          updated_at = now()`,
			[id, ...vals, userId],
		);
		return this.get(missionId);
	}

	// Why the Batteries section is not complete yet (empty when it is).
	async blockers(missionId: number): Promise<string[]> {
		const b = await this.get(missionId);
		const out: string[] = [];
		const labels =
			b.packs.length === SGX_SLOTS.length ? SGX_LABELS : SEAGLIDER_LABELS;
		for (const p of b.packs) {
			const done =
				p.installedAssetId !== null &&
				p.installedOn !== null &&
				p.installedWeightG !== null &&
				p.installedVoltageV !== null;
			if (!done)
				out.push(
					`Batteries: ${labels[p.position] ?? p.position} pack not recorded.`,
				);
		}
		if (!b.checks.fuelGaugesReset)
			out.push("Batteries: fuel gauges not reset.");
		if (!b.checks.ah0Updated)
			out.push("Batteries: $AH0 values not entered in pdos.");
		return out;
	}
}
