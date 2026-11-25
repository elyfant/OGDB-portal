import {
	BadRequestException,
	HttpException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { BuildChange, RefurbFinalPrep } from "@ogdb/types";
import type { Pool } from "pg";
import { ArgosTagsService } from "../argos-tags/argos-tags.service";
import { PG_POOL } from "../db/db.constants";
import { applyMissionBuildChangesTx } from "../gliders/build.helpers";
import { type Kind, coerce } from "./field-coerce";

// The tag's own limits from the procedure.
const TAG_BATTERY_V: [number, number] = [3.3, 3.7];
const TAG_TRANSMISSIONS_LIMIT = 40000;

// field -> column -> kind. The SELECT and the upsert are generated from it.
const FIELDS: ReadonlyArray<readonly [string, string, Kind]> = [
	["pressureFinalPsia", "pressure_final_psia", "num"],
	["travelModeSet", "travel_mode_set", "bool"],
	["gliderOff", "glider_off", "bool"],
	["argosAssetId", "argos_asset_id", "int"],
	["tagTimeSynced", "tag_time_synced", "bool"],
	["tagConfigConfirmed", "tag_config_confirmed", "bool"],
	["tagAutoStart", "tag_auto_start", "bool"],
	["packTagClamps", "pack_tag_clamps", "bool"],
	["packCommsCable", "pack_comms_cable", "bool"],
	["packShortingOrWand", "pack_shorting_or_wand", "bool"],
	["packWings", "pack_wings", "bool"],
	["packRudder", "pack_rudder", "bool"],
	["packCradle", "pack_cradle", "bool"],
	["packSpareKit", "pack_spare_kit", "bool"],
	["packReleaseMechanism", "pack_release_mechanism", "bool"],
	["packPc", "pack_pc", "bool"],
	["notes", "notes", "text"],
];

const PACKING: ReadonlyArray<readonly [string, string]> = [
	["packTagClamps", "Argos tag with clamps, screws and Allen key"],
	["packCommsCable", "Communication cable and USB converter"],
	["packShortingOrWand", "Magnetic wand (Rev B) / shorting cable (Rev E)"],
	["packWings", "Wings"],
	["packRudder", "Rudder"],
	["packCradle", "Cradle"],
	["packSpareKit", "Spare kit (screws, tools, sensor caps)"],
	["packReleaseMechanism", "Deployment release mechanism"],
	["packPc", "PC with Tera Term"],
];

const personName = (alias: string) =>
	`NULLIF(TRIM(${alias}.first_name || ' ' || ${alias}.last_name), '')`;

@Injectable()
export class FinalPrepService {
	constructor(
		@Inject(PG_POOL) private readonly pool: Pool,
		private readonly argos: ArgosTagsService,
	) {}

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

	async get(missionId: number): Promise<RefurbFinalPrep> {
		const { id } = await this.refurbishment(missionId);
		const cols = FIELDS.map(([key, column, kind]) =>
			kind === "num"
				? `f.${column}::float8 AS "${key}"`
				: `f.${column} AS "${key}"`,
		).join(", ");
		const [row, tags, knownTagTypes] = await Promise.all([
			this.pool.query(
				`SELECT ${cols}, f.tag_measurement_id AS "tagMeasurementId",
                f.updated_at AS "updatedAt",
                ${personName("uc")} AS "updatedByName"
           FROM refurb_final_prep f
           LEFT JOIN users uu ON uu.id = f.updated_by
           LEFT JOIN contacts uc ON uc.id = uu.contact_id
          WHERE f.refurbishment_id = $1`,
				[id],
			),
			this.pool.query(
				`SELECT a.id AS "assetId", a.serial_number AS "serialNumber",
              d.model, d.argos_dec AS "argosDec", d.argos_hex AS "argosHex",
              d.tag_name AS "tagName"
         FROM assets a
         JOIN asset_types t ON t.id = a.asset_type_id
         LEFT JOIN asset_argos_tag_details d ON d.asset_id = a.id
        WHERE t.name = 'argos_tag' AND a.decommissioned_date IS NULL
        ORDER BY a.serial_number, a.id`,
			),
			this.argos.knownTypes(),
		]);

		const saved = row.rows[0] ?? {
			updatedAt: null,
			updatedByName: null,
			...Object.fromEntries(
				FIELDS.map(([key, , kind]) => [key, kind === "bool" ? false : null]),
			),
		};
		const { tagMeasurementId, ...rest } = saved as typeof saved & {
			tagMeasurementId?: number | null;
		};
		return {
			...rest,
			tagCandidates: tags.rows,
			// The tag's configuration lives on the tag asset; its test readings in
			// the tag's measurement history. This logsheet just points at both.
			tagConfig: rest.argosAssetId
				? await this.argos.config(rest.argosAssetId)
				: null,
			tagTest: await this.argos.test(tagMeasurementId ?? null),
			knownTagTypes,
		};
	}

	// Saves the whole section. If a different Argos tag is chosen than the
	// mission's build holds, the build is changed in the same transaction.
	async save(
		missionId: number,
		input: Record<string, unknown>,
		userId: number,
	): Promise<RefurbFinalPrep> {
		const { id, gliderAssetId } = await this.refurbishment(missionId);
		const known = new Set<string>([
			...FIELDS.map(([k]) => k),
			"tagConfig",
			"tagTest",
		]);
		for (const k of Object.keys(input)) {
			if (!known.has(k)) throw new BadRequestException(`Unknown field "${k}".`);
		}
		const values = FIELDS.map(([key, , kind]) => {
			const v = coerce(key, kind, input[key]);
			return kind === "bool" ? (v ?? false) : v;
		});
		const byKey = Object.fromEntries(FIELDS.map(([k], i) => [k, values[i]]));
		const argosAssetId = byKey.argosAssetId as number | null;
		const asObject = (v: unknown, name: string) => {
			if (v === undefined || v === null) return null;
			if (typeof v !== "object" || Array.isArray(v)) {
				throw new BadRequestException(`${name}: expected an object.`);
			}
			return v as Record<string, unknown>;
		};
		const tagConfig = asObject(input.tagConfig, "tagConfig");
		const tagTest = asObject(input.tagTest, "tagTest");
		if ((tagConfig || tagTest) && argosAssetId === null) {
			throw new BadRequestException("Choose the Argos tag first.");
		}

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			await client.query(
				"SELECT 1 FROM refurbishments WHERE id = $1 FOR UPDATE",
				[id],
			);

			if (argosAssetId !== null) {
				const ok = await client.query(
					`SELECT 1 FROM assets a JOIN asset_types t ON t.id = a.asset_type_id
            WHERE a.id = $1 AND t.name = 'argos_tag'`,
					[argosAssetId],
				);
				if (ok.rows.length === 0) {
					throw new BadRequestException("That asset is not an Argos tag.");
				}
				const current = await client.query(
					`SELECT i.id AS "itemId", i.asset_id AS "assetId"
             FROM mission_build_items i
             JOIN assets a ON a.id = i.asset_id
             JOIN asset_types t ON t.id = a.asset_type_id
            WHERE i.mission_id = $1 AND t.name = 'argos_tag'
              AND i.parent_item_id IS NULL`,
					[missionId],
				);
				const item = current.rows[0];
				if (item?.assetId !== argosAssetId) {
					const change: BuildChange = item
						? {
								action: "replace",
								itemId: item.itemId,
								childAssetId: argosAssetId,
							}
						: {
								action: "add",
								parentAssetId: gliderAssetId,
								childAssetId: argosAssetId,
								position: null,
							};
					await applyMissionBuildChangesTx(
						client,
						missionId,
						[change],
						"Refurbishment logsheet: Argos tag",
						userId,
					);
				}
			}

			// The tag's configuration goes on the tag asset; the test readings into
			// its measurement history. Both in this same transaction, so a refused
			// value leaves the logsheet and the tag untouched.
			if (argosAssetId !== null && tagConfig) {
				await this.argos.saveConfig(client, argosAssetId, tagConfig, userId);
			}
			const prior = await client.query(
				"SELECT tag_measurement_id FROM refurb_final_prep WHERE refurbishment_id = $1",
				[id],
			);
			let measurementId: number | null =
				prior.rows[0]?.tag_measurement_id ?? null;
			if (argosAssetId !== null && tagTest) {
				measurementId = await this.argos.saveTest(
					client,
					argosAssetId,
					tagTest,
					userId,
					measurementId,
				);
			}

			const columns = [...FIELDS.map(([, c]) => c), "tag_measurement_id"];
			const params = columns.map((_, i) => `$${i + 2}`);
			await client.query(
				`INSERT INTO refurb_final_prep (refurbishment_id, ${columns.join(", ")}, updated_by)
         VALUES ($1, ${params.join(", ")}, $${columns.length + 2})
         ON CONFLICT (refurbishment_id) DO UPDATE SET
           ${columns.map((c) => `${c} = EXCLUDED.${c}`).join(", ")},
           updated_by = EXCLUDED.updated_by, updated_at = now()`,
				[id, ...values, measurementId, userId],
			);
			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			if (err instanceof HttpException) throw err;
			const e = err as { code?: string };
			if (e.code === "23514" || e.code === "22003") {
				throw new BadRequestException(
					"A value is out of range. Pressure is in psia (about 9 when pulled).",
				);
			}
			throw err;
		} finally {
			client.release();
		}
		return this.get(missionId);
	}

	// Why Final prep is not complete yet (empty when it is).
	async blockers(missionId: number): Promise<string[]> {
		const f = await this.get(missionId);
		const out: string[] = [];
		const missing: string[] = [];
		if (f.pressureFinalPsia === null) missing.push("final pressure");
		if (!f.travelModeSet) missing.push("travel mode");
		if (!f.gliderOff) missing.push("glider off");
		if (f.argosAssetId === null) {
			missing.push("Argos tag");
		} else {
			const config = this.argos.missingConfig(f.tagConfig);
			if (config.length > 0) missing.push(`tag details (${config.join(", ")})`);
			const test = this.argos.missingTest(f.tagTest);
			if (test.length > 0) missing.push(`tag test (${test.join(", ")})`);
		}
		if (!f.tagTimeSynced) missing.push("tag time sync");
		if (!f.tagConfigConfirmed) missing.push("tag config");
		if (!f.tagAutoStart) missing.push("tag auto-start");
		const unpacked = PACKING.filter(
			([key]) => !(f as unknown as Record<string, unknown>)[key],
		).map(([, label]) => label);
		if (unpacked.length > 0) missing.push(`${unpacked.length} packing item(s)`);
		if (missing.length > 0) {
			out.push(`Final prep: missing ${missing.join(", ")}.`);
		}

		// The tag's own limits from the procedure, checked on what was typed in.
		const t = f.tagTest;
		if (t.transmissionTestPassed === false) {
			out.push("Final prep: the tag's transmission test failed.");
		}
		if (
			t.batteryVoltage !== null &&
			(t.batteryVoltage < TAG_BATTERY_V[0] ||
				t.batteryVoltage > TAG_BATTERY_V[1])
		) {
			out.push(
				`Final prep: tag battery ${t.batteryVoltage} V is outside ${TAG_BATTERY_V[0]}–${TAG_BATTERY_V[1]} V.`,
			);
		}
		if (t.txAttempts !== null && t.txAttempts > TAG_TRANSMISSIONS_LIMIT) {
			out.push(
				`Final prep: tag has attempted ${t.txAttempts} transmissions (limit ${TAG_TRANSMISSIONS_LIMIT}).`,
			);
		}
		return out;
	}
}
