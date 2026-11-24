import {
	BadRequestException,
	HttpException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { RefurbDeviceTest, RefurbDeviceTests } from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import { getMissionBuild } from "../gliders/build.helpers";
import { MAX_TEXT } from "./field-coerce";

// The Seaglider's own devices. Always expected, whatever science sensors are
// fitted. The hints are reminders from the procedure.
const BUILTIN: ReadonlyArray<{
	key: string;
	label: string;
	hint: string | null;
}> = [
	{ key: "altimeter", label: "Altimeter", hint: null },
	{
		key: "compass",
		label: "Compass",
		hint: "Compass calibration is done in water after deployment.",
	},
	{ key: "gps", label: "GPS", hint: null },
	{
		key: "pressure_sensor",
		label: "Pressure sensor",
		hint: "Calibrated to sea level at the final shipboard selftest before deployment.",
	},
];

const SENSOR_LABELS: Record<string, string> = {
	ct_sensor: "CT sensor",
	do_sensor: "Oxygen optode (DO)",
	eco_sensor: "ECO sensor",
	mr_sensor: "MicroRider",
};

const personName = (alias: string) =>
	`NULLIF(TRIM(${alias}.first_name || ' ' || ${alias}.last_name), '')`;

@Injectable()
export class DeviceTestsService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	private async refurbishmentId(missionId: number): Promise<number> {
		const r = await this.pool.query(
			"SELECT id FROM refurbishments WHERE mission_id = $1",
			[missionId],
		);
		if (r.rows.length === 0) {
			throw new NotFoundException(
				`Mission ${missionId} has no refurbishment logsheet.`,
			);
		}
		return r.rows[0].id;
	}

	// Every device that should be tested: the built-in four plus each
	// science sensor in this mission's build. Nothing here is stored, so the
	// list cannot disagree with the build.
	private async expected(
		missionId: number,
	): Promise<
		Omit<RefurbDeviceTest, "result" | "note" | "updatedAt" | "updatedByName">[]
	> {
		const build = await getMissionBuild(this.pool, missionId);
		const sensors = build.components
			.filter((c) => c.assetTypeGroup === "sensor")
			.map((c) => ({
				key: `sensor-${c.assetId}`,
				label: SENSOR_LABELS[c.assetType] ?? c.assetType,
				detail: [c.serialNumber, c.model].filter(Boolean).join(" · ") || null,
				kind: "sensor" as const,
				hint: null,
			}));
		return [
			...BUILTIN.map((d) => ({
				key: d.key,
				label: d.label,
				detail: null,
				kind: "builtin" as const,
				hint: d.hint,
			})),
			...sensors,
		];
	}

	async get(missionId: number): Promise<RefurbDeviceTests> {
		const id = await this.refurbishmentId(missionId);
		const [expected, rows] = await Promise.all([
			this.expected(missionId),
			this.pool.query(
				`SELECT COALESCE(t.device, 'sensor-' || t.asset_id) AS key,
                t.result, t.note, t.updated_at AS "updatedAt",
                ${personName("uc")} AS "updatedByName"
           FROM refurb_device_tests t
           LEFT JOIN users uu ON uu.id = t.updated_by
           LEFT JOIN contacts uc ON uc.id = uu.contact_id
          WHERE t.refurbishment_id = $1`,
				[id],
			),
		]);
		const byKey = new Map(rows.rows.map((r) => [r.key, r]));
		return {
			devices: expected.map((d) => {
				const r = byKey.get(d.key);
				return {
					...d,
					result: r?.result ?? null,
					note: r?.note ?? null,
					updatedAt: r?.updatedAt ?? null,
					updatedByName: r?.updatedByName ?? null,
				};
			}),
		};
	}

	// Saves a batch of device results in one transaction. Only devices the
	// glider actually has can be saved, and a fail must say what was wrong.
	async save(
		missionId: number,
		input: Record<string, unknown>,
		userId: number,
	): Promise<RefurbDeviceTests> {
		const id = await this.refurbishmentId(missionId);
		for (const k of Object.keys(input)) {
			if (k !== "tests") throw new BadRequestException(`Unknown field "${k}".`);
		}
		const tests = input.tests;
		if (!Array.isArray(tests) || tests.length > 40) {
			throw new BadRequestException(
				"tests: expected a list of device results.",
			);
		}
		const valid = new Set((await this.expected(missionId)).map((d) => d.key));

		const parsed = tests.map((t) => {
			const key = typeof t?.key === "string" ? t.key : "";
			if (!valid.has(key)) {
				throw new BadRequestException(
					`"${key}" is not a device on this glider.`,
				);
			}
			const result = t.result ?? null;
			if (result !== null && result !== "pass" && result !== "fail") {
				throw new BadRequestException(`${key}: result must be pass or fail.`);
			}
			const note =
				typeof t.note === "string" && t.note.trim() !== ""
					? t.note.trim()
					: null;
			if (note !== null && note.length > MAX_TEXT) {
				throw new BadRequestException(`${key}: note is too long.`);
			}
			if (result === "fail" && note === null) {
				throw new BadRequestException(
					`${key}: say what failed before saving a fail.`,
				);
			}
			return { key, result, note };
		});

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			for (const t of parsed) {
				if (t.key.startsWith("sensor-")) {
					await client.query(
						`INSERT INTO refurb_device_tests (refurbishment_id, asset_id, result, note, updated_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (refurbishment_id, asset_id) WHERE asset_id IS NOT NULL
             DO UPDATE SET result = EXCLUDED.result, note = EXCLUDED.note,
                           updated_by = EXCLUDED.updated_by, updated_at = now()`,
						[
							id,
							Number(t.key.slice("sensor-".length)),
							t.result,
							t.note,
							userId,
						],
					);
				} else {
					await client.query(
						`INSERT INTO refurb_device_tests (refurbishment_id, device, result, note, updated_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (refurbishment_id, device) WHERE device IS NOT NULL
             DO UPDATE SET result = EXCLUDED.result, note = EXCLUDED.note,
                           updated_by = EXCLUDED.updated_by, updated_at = now()`,
						[id, t.key, t.result, t.note, userId],
					);
				}
			}
			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			if (err instanceof HttpException) throw err;
			throw err;
		} finally {
			client.release();
		}
		return this.get(missionId);
	}

	// Why Device tests is not complete yet (empty when it is): every expected
	// device must have passed.
	async blockers(missionId: number): Promise<string[]> {
		const { devices } = await this.get(missionId);
		const failed = devices
			.filter((d) => d.result === "fail")
			.map((d) => d.label);
		const untested = devices.filter((d) => d.result === null);
		const out: string[] = [];
		if (failed.length > 0) {
			out.push(`Device tests: failed: ${failed.join(", ")}.`);
		}
		if (untested.length > 0) {
			out.push(
				`Device tests: ${untested.length} of ${devices.length} not tested.`,
			);
		}
		return out;
	}
}
