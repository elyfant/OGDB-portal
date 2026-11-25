import {
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	ArgosTagConfig,
	ArgosTagDetail,
	ArgosTagMeasurement,
	ArgosTagTest,
} from "@ogdb/types";
import type { Pool, PoolClient } from "pg";
import { PG_POOL } from "../db/db.constants";

type Db = Pool | PoolClient;

const MAX_TAGWARE = 50;

const personName = (alias: string) =>
	`NULLIF(TRIM(${alias}.first_name || ' ' || ${alias}.last_name), '')`;

const blank = (v: unknown) => v === null || v === undefined || v === "";

// Whole non-negative number from a form value ("12", 12, ""), or null.
function wholeNumber(v: unknown, label: string): number | null {
	if (blank(v)) return null;
	const n = typeof v === "string" ? Number(v) : v;
	if (typeof n !== "number" || !Number.isInteger(n) || n < 0) {
		throw new BadRequestException(
			`${label}: expected a whole number, 0 or more.`,
		);
	}
	return n;
}

// Everything about an Argos tag that is not specific to one refurbishment:
// its configuration (kept on the tag asset, so it is entered once) and its
// test readings (an append-only history). The refurbishment logsheet uses this
// for the old tag at Intake and the new tag in Final prep, and the asset page
// reads the history through it.
@Injectable()
export class ArgosTagsService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	async config(assetId: number, db: Db = this.pool): Promise<ArgosTagConfig> {
		const r = await db.query(
			`SELECT a.id AS "assetId", a.serial_number AS "serialNumber",
              d.model, d.argos_dec AS "argosDec", d.argos_hex AS "argosHex",
              d.tag_name AS "tagName"
         FROM assets a
         JOIN asset_types t ON t.id = a.asset_type_id
         LEFT JOIN asset_argos_tag_details d ON d.asset_id = a.id
        WHERE a.id = $1 AND t.name = 'argos_tag'`,
			[assetId],
		);
		if (r.rows.length === 0) {
			throw new NotFoundException(`Asset ${assetId} is not an Argos tag.`);
		}
		return r.rows[0];
	}

	// The readings recorded under one measurement id, or an empty test.
	async test(
		measurementId: number | null,
		db: Db = this.pool,
	): Promise<ArgosTagTest> {
		const empty: ArgosTagTest = {
			measurementId: null,
			measuredDate: null,
			tagwareVersion: null,
			txAttempts: null,
			txFailCount: null,
			batteryVoltage: null,
			transmissionTestPassed: null,
		};
		if (measurementId === null) return empty;
		const r = await db.query(
			`SELECT id AS "measurementId", to_char(measured_date, 'YYYY-MM-DD') AS "measuredDate",
              tagware_version AS "tagwareVersion", tx_attempts AS "txAttempts",
              tx_fail_count AS "txFailCount", battery_voltage AS "batteryVoltage",
              transmission_test_passed AS "transmissionTestPassed"
         FROM asset_argos_tag_measurements WHERE id = $1`,
			[measurementId],
		);
		return r.rows[0] ?? empty;
	}

	// Is a test's every reading filled in?
	missingTest(t: ArgosTagTest): string[] {
		const out: string[] = [];
		if (t.tagwareVersion === null) out.push("tagware version");
		if (t.txAttempts === null) out.push("Tx attempts");
		if (t.txFailCount === null) out.push("Tx fail count");
		if (t.batteryVoltage === null) out.push("battery voltage");
		if (t.transmissionTestPassed === null) out.push("transmission test result");
		return out;
	}

	// Records the readings typed in for one test of a tag, in the caller's
	// transaction. The FIRST save adds a row to the tag's history; saving again
	// from the same logsheet corrects that same row (a typo is not a second test),
	// and a different tag gets its own row. Returns the row's id, or null when
	// nothing was entered (and removes a row that has been emptied again).
	async saveTest(
		client: PoolClient,
		assetId: number,
		input: Record<string, unknown>,
		userId: number,
		existingMeasurementId: number | null,
	): Promise<number | null> {
		for (const k of Object.keys(input)) {
			if (
				![
					"tagwareVersion",
					"txAttempts",
					"txFailCount",
					"batteryVoltage",
					"transmissionTestPassed",
				].includes(k)
			) {
				throw new BadRequestException(`Unknown field "${k}" in the tag test.`);
			}
		}
		let tagware: string | null = null;
		if (!blank(input.tagwareVersion)) {
			if (typeof input.tagwareVersion !== "string") {
				throw new BadRequestException("Tagware version: expected text.");
			}
			tagware = input.tagwareVersion.trim() || null;
			if (tagware !== null && tagware.length > MAX_TAGWARE) {
				throw new BadRequestException(
					`Tagware version: at most ${MAX_TAGWARE} characters.`,
				);
			}
		}
		const attempts = wholeNumber(input.txAttempts, "Tx attempts");
		const fails = wholeNumber(input.txFailCount, "Tx fail count");
		if (attempts !== null && fails !== null && fails > attempts) {
			throw new BadRequestException(
				"Tx fail count can't be more than the Tx attempts.",
			);
		}
		let volts: number | null = null;
		if (!blank(input.batteryVoltage)) {
			const n =
				typeof input.batteryVoltage === "string"
					? Number(input.batteryVoltage.replace(",", "."))
					: input.batteryVoltage;
			if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 10) {
				throw new BadRequestException(
					"Battery voltage: a number of volts between 0 and 10.",
				);
			}
			volts = n;
		}
		let ok: boolean | null = null;
		if (!blank(input.transmissionTestPassed)) {
			if (typeof input.transmissionTestPassed !== "boolean") {
				throw new BadRequestException(
					"Transmission test: expected pass or fail.",
				);
			}
			ok = input.transmissionTestPassed;
		}

		await this.config(assetId, client);
		const nothing =
			tagware === null &&
			attempts === null &&
			fails === null &&
			volts === null &&
			ok === null;

		// Only correct the row if it still belongs to THIS tag.
		let reuse: number | null = null;
		if (existingMeasurementId !== null) {
			const own = await client.query(
				"SELECT asset_id FROM asset_argos_tag_measurements WHERE id = $1",
				[existingMeasurementId],
			);
			if (own.rows[0]?.asset_id === assetId) reuse = existingMeasurementId;
		}
		if (nothing) {
			if (reuse !== null) {
				await client.query(
					"DELETE FROM asset_argos_tag_measurements WHERE id = $1",
					[reuse],
				);
			}
			return null;
		}
		if (reuse !== null) {
			// Saving the same readings again is not an edit: leave the row (and its
			// audit trail) alone.
			const cur = (
				await client.query(
					`SELECT tagware_version, tx_attempts, tx_fail_count, battery_voltage,
                  transmission_test_passed
             FROM asset_argos_tag_measurements WHERE id = $1`,
					[reuse],
				)
			).rows[0];
			const same =
				cur.tagware_version === tagware &&
				cur.tx_attempts === attempts &&
				cur.tx_fail_count === fails &&
				cur.battery_voltage === volts &&
				cur.transmission_test_passed === ok;
			if (!same) {
				await client.query(
					`UPDATE asset_argos_tag_measurements
              SET tagware_version = $2, tx_attempts = $3, tx_fail_count = $4,
                  battery_voltage = $5, transmission_test_passed = $6, changed_by = $7
            WHERE id = $1`,
					[reuse, tagware, attempts, fails, volts, ok, userId],
				);
			}
			return reuse;
		}
		const r = await client.query(
			`INSERT INTO asset_argos_tag_measurements
         (asset_id, tagware_version, tx_attempts, tx_fail_count, battery_voltage,
          transmission_test_passed, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
			[assetId, tagware, attempts, fails, volts, ok, userId],
		);
		return r.rows[0].id;
	}

	// A tag's configuration and its measurement history, for the asset page.
	async detail(assetId: number): Promise<ArgosTagDetail> {
		const [config, rows] = await Promise.all([
			this.config(assetId),
			this.pool.query(
				`SELECT m.id, to_char(m.measured_date, 'YYYY-MM-DD') AS "measuredDate",
                m.tagware_version AS "tagwareVersion", m.tx_attempts AS "txAttempts",
                m.tx_fail_count AS "txFailCount", m.battery_voltage AS "batteryVoltage",
                m.transmission_test_passed AS "transmissionTestPassed", m.notes,
                ${personName("c")} AS "changedByName"
           FROM asset_argos_tag_measurements m
           LEFT JOIN users u ON u.id = m.changed_by
           LEFT JOIN contacts c ON c.id = u.contact_id
          WHERE m.asset_id = $1
          ORDER BY m.measured_date DESC, m.id DESC`,
				[assetId],
			),
		]);
		return {
			config,
			measurements: rows.rows as ArgosTagMeasurement[],
		};
	}
}
