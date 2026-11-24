import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	BuildChange,
	RefurbSensor,
	RefurbSensorCandidate,
	RefurbSensors,
} from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import {
	applyMissionBuildChangesTx,
	getMissionBuild,
} from "../gliders/build.helpers";
import { MAX_TEXT } from "./field-coerce";

const SENSOR_TYPE_LABELS: Record<string, string> = {
	ct_sensor: "CT sensor",
	do_sensor: "Oxygen optode (DO)",
	eco_sensor: "ECO sensor",
	mr_sensor: "MicroRider",
};

// The CT sail's zero-conductivity frequency has to be checked (the Legato and
// the GPCTD have no such step).
const isCtSail = (assetType: string, model: string | null) =>
	assetType === "ct_sensor" && /sail|apl/i.test(model ?? "");

const personName = (alias: string) =>
	`NULLIF(TRIM(${alias}.first_name || ' ' || ${alias}.last_name), '')`;

const labelOf = (assetType: string, serial: string | null) =>
	`${SENSOR_TYPE_LABELS[assetType] ?? assetType}${serial ? ` ${serial}` : ""}`;

// Section 4 of the refurbishment logsheet. The fitted sensors come from the
// mission build; swapping one here changes the build in the same transaction,
// the way batteries and the Argos tag do. Calibration is not re-implemented:
// the latest calibration on record is shown, and "needs calibration" is the
// old sheet's "Cal required?".
@Injectable()
export class SensorsService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	private async refurbishment(
		missionId: number,
	): Promise<{ id: number; gliderAssetId: number }> {
		const r = await this.pool.query(
			`SELECT r.id, m.glider_asset_id AS "gliderAssetId"
         FROM refurbishments r JOIN missions m ON m.id = r.mission_id
        WHERE r.mission_id = $1`,
			[missionId],
		);
		if (r.rows.length === 0) {
			throw new NotFoundException(
				`Mission ${missionId} has no refurbishment logsheet.`,
			);
		}
		return r.rows[0];
	}

	async get(missionId: number): Promise<RefurbSensors> {
		const { id } = await this.refurbishment(missionId);
		const build = await getMissionBuild(this.pool, missionId);
		const fitted = build.components.filter(
			(c) => c.assetTypeGroup === "sensor",
		);
		const calDate = new Map(
			build.sciencePayload.map((s) => [s.assetId, s.calibration?.date ?? null]),
		);

		const [swaps, checks, candidates] = await Promise.all([
			this.pool.query(
				`SELECT s.new_asset_id AS "newId", s.old_asset_id AS "oldId",
                t.name AS "oldType", a.serial_number AS "oldSerial"
           FROM refurb_sensor_swaps s
           LEFT JOIN assets a ON a.id = s.old_asset_id
           LEFT JOIN asset_types t ON t.id = a.asset_type_id
          WHERE s.refurbishment_id = $1`,
				[id],
			),
			this.pool.query(
				`SELECT k.asset_id AS "assetId", k.reviewed,
                k.coefficients_ok AS "coefficientsOk",
                k.zero_frequency_ok AS "zeroFrequencyOk",
                k.needs_calibration AS "needsCalibration", k.notes,
                k.updated_at AS "updatedAt", ${personName("uc")} AS "updatedByName"
           FROM refurb_sensor_checks k
           LEFT JOIN users uu ON uu.id = k.updated_by
           LEFT JOIN contacts uc ON uc.id = uu.contact_id
          WHERE k.refurbishment_id = $1`,
				[id],
			),
			this.pool.query(
				`SELECT a.id, t.name AS "assetType", a.serial_number AS "serialNumber"
           FROM assets a
           JOIN asset_types t ON t.id = a.asset_type_id
           JOIN asset_type_groups g ON g.id = t.group_id
          WHERE g.name = 'sensor' AND a.decommissioned_date IS NULL
            AND a.id NOT IN (SELECT asset_id FROM mission_build_items WHERE mission_id = $1)
          ORDER BY t.name, a.serial_number, a.id`,
				[missionId],
			),
		]);

		const swapByNew = new Map(swaps.rows.map((r) => [r.newId, r]));
		const checkByAsset = new Map(checks.rows.map((r) => [r.assetId, r]));

		const sensors: RefurbSensor[] = fitted.map((c) => {
			const swap = swapByNew.get(c.assetId);
			const k = checkByAsset.get(c.assetId);
			return {
				assetId: c.assetId,
				assetType: c.assetType,
				typeLabel: SENSOR_TYPE_LABELS[c.assetType] ?? c.assetType,
				serialNumber: c.serialNumber,
				model: c.model,
				position: c.position,
				calibrationDate: calDate.get(c.assetId) ?? null,
				replaced: Boolean(swap),
				replacedLabel: swap?.oldType
					? labelOf(swap.oldType, swap.oldSerial)
					: null,
				requiresZeroFrequency: isCtSail(c.assetType, c.model),
				reviewed: k?.reviewed ?? false,
				coefficientsOk: k?.coefficientsOk ?? false,
				zeroFrequencyOk: k?.zeroFrequencyOk ?? false,
				needsCalibration: k?.needsCalibration ?? false,
				notes: k?.notes ?? null,
				updatedAt: k?.updatedAt ?? null,
				updatedByName: k?.updatedByName ?? null,
			};
		});

		const cands: RefurbSensorCandidate[] = candidates.rows.map((r) => ({
			id: r.id,
			assetType: r.assetType,
			label: labelOf(r.assetType, r.serialNumber),
		}));
		return { sensors, candidates: cands };
	}

	// Puts a sensor in the build: replaces `oldAssetId`, or adds one if there is
	// none. The build change and the record of it succeed or fail together.
	async swap(
		missionId: number,
		input: Record<string, unknown>,
		userId: number,
	): Promise<RefurbSensors> {
		const { id, gliderAssetId } = await this.refurbishment(missionId);
		for (const k of Object.keys(input)) {
			if (k !== "oldAssetId" && k !== "newAssetId") {
				throw new BadRequestException(`Unknown field "${k}".`);
			}
		}
		const newAssetId = Number(input.newAssetId);
		const oldAssetId =
			input.oldAssetId === undefined || input.oldAssetId === null
				? null
				: Number(input.oldAssetId);
		if (!Number.isInteger(newAssetId)) {
			throw new BadRequestException("Choose the sensor to put in.");
		}
		if (oldAssetId !== null && !Number.isInteger(oldAssetId)) {
			throw new BadRequestException("oldAssetId: expected a whole number.");
		}

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			await client.query(
				"SELECT 1 FROM refurbishments WHERE id = $1 FOR UPDATE",
				[id],
			);

			const ok = await client.query(
				`SELECT 1 FROM assets a
           JOIN asset_types t ON t.id = a.asset_type_id
           JOIN asset_type_groups g ON g.id = t.group_id
          WHERE a.id = $1 AND g.name = 'sensor' AND a.decommissioned_date IS NULL`,
				[newAssetId],
			);
			if (ok.rows.length === 0) {
				throw new BadRequestException(
					"That is not a sensor that can be fitted (it may be decommissioned).",
				);
			}
			const already = await client.query(
				"SELECT 1 FROM mission_build_items WHERE mission_id = $1 AND asset_id = $2",
				[missionId, newAssetId],
			);
			if (already.rows.length > 0) {
				throw new ConflictException("That sensor is already in this build.");
			}

			let change: BuildChange;
			if (oldAssetId !== null) {
				const item = await client.query(
					"SELECT id FROM mission_build_items WHERE mission_id = $1 AND asset_id = $2",
					[missionId, oldAssetId],
				);
				if (item.rows.length === 0) {
					throw new ConflictException(
						"The sensor to replace is no longer in this build.",
					);
				}
				change = {
					action: "replace",
					itemId: item.rows[0].id,
					childAssetId: newAssetId,
				};
			} else {
				change = {
					action: "add",
					parentAssetId: gliderAssetId,
					childAssetId: newAssetId,
					position: null,
				};
			}
			await applyMissionBuildChangesTx(
				client,
				missionId,
				[change],
				"Refurbishment logsheet: sensor",
				userId,
			);

			// A sensor swapped again (a correction) keeps one row: it now names the
			// newest sensor, and still remembers what was there originally.
			const earlier =
				oldAssetId === null
					? null
					: await client.query(
							`SELECT id FROM refurb_sensor_swaps
                WHERE refurbishment_id = $1 AND new_asset_id = $2`,
							[id, oldAssetId],
						);
			if (earlier && earlier.rows.length > 0) {
				await client.query(
					`UPDATE refurb_sensor_swaps
              SET new_asset_id = $1, swapped_by = $2, swapped_at = now()
            WHERE id = $3`,
					[newAssetId, userId, earlier.rows[0].id],
				);
				await client.query(
					"DELETE FROM refurb_sensor_checks WHERE refurbishment_id = $1 AND asset_id = $2",
					[id, oldAssetId],
				);
			} else {
				await client.query(
					`INSERT INTO refurb_sensor_swaps (refurbishment_id, old_asset_id, new_asset_id, swapped_by)
           VALUES ($1, $2, $3, $4)`,
					[id, oldAssetId, newAssetId, userId],
				);
			}
			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}
		return this.get(missionId);
	}

	// Saves the per-sensor checks for the sensors that changed.
	async saveChecks(
		missionId: number,
		input: Record<string, unknown>,
		userId: number,
	): Promise<RefurbSensors> {
		const { id } = await this.refurbishment(missionId);
		for (const k of Object.keys(input)) {
			if (k !== "checks")
				throw new BadRequestException(`Unknown field "${k}".`);
		}
		const checks = input.checks;
		if (!Array.isArray(checks) || checks.length > 40) {
			throw new BadRequestException("checks: expected a list of sensors.");
		}
		const build = await getMissionBuild(this.pool, missionId);
		const fitted = new Set(
			build.components
				.filter((c) => c.assetTypeGroup === "sensor")
				.map((c) => c.assetId),
		);

		const flag = (v: unknown, name: string): boolean => {
			if (v === undefined || v === null) return false;
			if (typeof v !== "boolean") {
				throw new BadRequestException(`${name}: expected true or false.`);
			}
			return v;
		};
		const parsed = checks.map((c) => {
			const assetId = Number(c?.assetId);
			if (!fitted.has(assetId)) {
				throw new BadRequestException(
					`Sensor ${c?.assetId} is not in this mission's build.`,
				);
			}
			const notes =
				typeof c.notes === "string" && c.notes.trim() !== ""
					? c.notes.trim()
					: null;
			if (notes !== null && notes.length > MAX_TEXT) {
				throw new BadRequestException("notes: too long.");
			}
			return {
				assetId,
				reviewed: flag(c.reviewed, "reviewed"),
				coefficientsOk: flag(c.coefficientsOk, "coefficientsOk"),
				zeroFrequencyOk: flag(c.zeroFrequencyOk, "zeroFrequencyOk"),
				needsCalibration: flag(c.needsCalibration, "needsCalibration"),
				notes,
			};
		});

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			for (const c of parsed) {
				await client.query(
					`INSERT INTO refurb_sensor_checks
             (refurbishment_id, asset_id, reviewed, coefficients_ok, zero_frequency_ok,
              needs_calibration, notes, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (refurbishment_id, asset_id) DO UPDATE SET
             reviewed = EXCLUDED.reviewed,
             coefficients_ok = EXCLUDED.coefficients_ok,
             zero_frequency_ok = EXCLUDED.zero_frequency_ok,
             needs_calibration = EXCLUDED.needs_calibration,
             notes = EXCLUDED.notes,
             updated_by = EXCLUDED.updated_by, updated_at = now()`,
					[
						id,
						c.assetId,
						c.reviewed,
						c.coefficientsOk,
						c.zeroFrequencyOk,
						c.needsCalibration,
						c.notes,
						userId,
					],
				);
			}
			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}
		return this.get(missionId);
	}

	// Why Sensors is not complete yet (empty when it is).
	async blockers(missionId: number): Promise<string[]> {
		const { sensors } = await this.get(missionId);
		if (sensors.length === 0) return ["Sensors: the build has no sensors."];
		const name = (s: RefurbSensor) => labelOf(s.assetType, s.serialNumber);
		const out: string[] = [];
		const unchecked = sensors.filter((s) => !s.reviewed);
		if (unchecked.length > 0) {
			out.push(`Sensors: not checked: ${unchecked.map(name).join(", ")}.`);
		}
		const coefficients = sensors.filter((s) => s.replaced && !s.coefficientsOk);
		if (coefficients.length > 0) {
			out.push(
				`Sensors: calibration coefficients not entered for ${coefficients.map(name).join(", ")}.`,
			);
		}
		const zero = sensors.filter(
			(s) => s.requiresZeroFrequency && !s.zeroFrequencyOk,
		);
		if (zero.length > 0) {
			out.push(
				`Sensors: zero frequency not checked for ${zero.map(name).join(", ")}.`,
			);
		}
		const cal = sensors.filter((s) => s.needsCalibration);
		if (cal.length > 0) {
			out.push(`Sensors: needs calibration: ${cal.map(name).join(", ")}.`);
		}
		return out;
	}
}
