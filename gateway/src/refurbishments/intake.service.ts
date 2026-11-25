import {
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	RefurbIntake,
	RefurbIntakeFault,
	RefurbIntakePreviousMission,
} from "@ogdb/types";
import type { Pool } from "pg";
import { ArgosTagsService } from "../argos-tags/argos-tags.service";
import { PG_POOL } from "../db/db.constants";
import { type Kind, coerce } from "./field-coerce";

// field -> column -> kind. The SELECT and the upsert are generated from it.
const FIELDS: ReadonlyArray<readonly [string, string, Kind]> = [
	["issuesReviewed", "issues_reviewed", "bool"],
	["issuesNotes", "issues_notes", "text"],
	["oldTagAssetId", "old_tag_asset_id", "int"],
	["tagRemoved", "tag_removed", "bool"],
	["tagActivated", "tag_activated", "bool"],
	["tagStopped", "tag_stopped", "bool"],
];

// Booleans that are never "unknown": not ticked means false.
const FLAGS = new Set([
	"issuesReviewed",
	"tagRemoved",
	"tagActivated",
	"tagStopped",
]);

const personName = (alias: string) =>
	`NULLIF(TRIM(${alias}.first_name || ' ' || ${alias}.last_name), '')`;

@Injectable()
export class IntakeService {
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

	// The glider's most recent mission before this one that actually went
	// out: not a workshop or a scheduled mission.
	private async previousMission(
		missionId: number,
		gliderAssetId: number,
	): Promise<
		(RefurbIntakePreviousMission & { tagAssetId: number | null }) | null
	> {
		const r = await this.pool.query(
			`SELECT m.id, m.mission_number AS "missionNumber",
              COALESCE(nm.std_mission_name, m.mission_name) AS name,
              to_char(m.retrieval_date, 'YYYY-MM-DD') AS "retrievalDate",
              ec.name AS "endingCause",
              (SELECT i.asset_id
                 FROM mission_build_items i
                 JOIN assets a ON a.id = i.asset_id
                 JOIN asset_types t ON t.id = a.asset_type_id
                WHERE i.mission_id = m.id AND t.name = 'argos_tag'
                  AND i.parent_item_id IS NULL
                LIMIT 1) AS "tagAssetId"
         FROM missions m
         JOIN status s ON s.id = m.status_id
         LEFT JOIN norglider_missions nm ON nm.id = m.id
         LEFT JOIN ending_causes ec ON ec.id = m.ending_cause_id
        WHERE m.glider_asset_id = $1 AND m.id <> $2
          AND s.name NOT IN ('workshop', 'scheduled')
        ORDER BY m.retrieval_date DESC NULLS LAST,
                 m.deployment_date DESC NULLS LAST, m.id DESC
        LIMIT 1`,
			[gliderAssetId, missionId],
		);
		return r.rows[0] ?? null;
	}

	// Unresolved faults on the glider itself and on everything in this
	// mission's build (the workshop starts as a copy of the last flown build,
	// so these are the parts that flew on the previous mission).
	private async openFaults(
		missionId: number,
		gliderAssetId: number,
	): Promise<RefurbIntakeFault[]> {
		const r = await this.pool.query(
			`SELECT f.id,
              COALESCE(agd.glider_name,
                       t.name || COALESCE(' ' || a.serial_number, '')) AS "assetLabel",
              to_char(f.reported_date, 'YYYY-MM-DD') AS "reportedDate",
              f.severity, f.status, f.description
         FROM asset_faults f
         JOIN assets a ON a.id = f.asset_id
         JOIN asset_types t ON t.id = a.asset_type_id
         LEFT JOIN asset_glider_details agd ON agd.asset_id = a.id
        WHERE f.status <> 'resolved'
          AND (f.asset_id = $2
               OR f.asset_id IN (SELECT asset_id FROM mission_build_items
                                  WHERE mission_id = $1))
        ORDER BY CASE f.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                                 WHEN 'medium' THEN 2 ELSE 3 END,
                 f.reported_date DESC`,
			[missionId, gliderAssetId],
		);
		return r.rows;
	}

	async get(missionId: number): Promise<RefurbIntake> {
		const { id, gliderAssetId } = await this.refurbishment(missionId);
		const cols = FIELDS.map(([key, column]) => `n.${column} AS "${key}"`).join(
			", ",
		);
		const [row, previous, faults, tags] = await Promise.all([
			this.pool.query(
				`SELECT ${cols}, n.old_tag_measurement_id AS "oldTagMeasurementId",
                n.updated_at AS "updatedAt",
                ${personName("uc")} AS "updatedByName"
           FROM refurb_intake n
           LEFT JOIN users uu ON uu.id = n.updated_by
           LEFT JOIN contacts uc ON uc.id = uu.contact_id
          WHERE n.refurbishment_id = $1`,
				[id],
			),
			this.previousMission(missionId, gliderAssetId),
			this.openFaults(missionId, gliderAssetId),
			this.pool.query(
				`SELECT a.id AS "assetId", a.serial_number AS "serialNumber",
              d.model, d.argos_dec AS "argosDec", d.argos_hex AS "argosHex",
              d.tag_name AS "tagName"
         FROM assets a
         JOIN asset_types t ON t.id = a.asset_type_id
         LEFT JOIN asset_argos_tag_details d ON d.asset_id = a.id
        WHERE t.name = 'argos_tag'
        ORDER BY a.serial_number, a.id`,
			),
		]);

		const saved = row.rows[0] ?? {
			updatedAt: null,
			updatedByName: null,
			...Object.fromEntries(
				FIELDS.map(([key, , kind]) => [
					key,
					kind === "bool" && FLAGS.has(key) ? false : null,
				]),
			),
		};
		const { oldTagMeasurementId, ...rest } = saved as typeof saved & {
			oldTagMeasurementId?: number | null;
		};
		// Until it is saved, suggest the tag the previous mission flew with.
		const oldTagAssetId = rest.oldTagAssetId ?? previous?.tagAssetId ?? null;
		return {
			...rest,
			oldTagAssetId,
			// The tag's own details are kept on the tag asset by whoever manages
			// the assets, not here. The test readings go in the tag's measurement
			// history, and this logsheet points at that row.
			tagTest: await this.argos.test(oldTagMeasurementId ?? null),
			previousMission: previous
				? {
						id: previous.id,
						missionNumber: previous.missionNumber,
						name: previous.name,
						retrievalDate: previous.retrievalDate,
						endingCause: previous.endingCause,
					}
				: null,
			openFaults: faults,
			tagCandidates: tags.rows,
		};
	}

	async save(
		missionId: number,
		input: Record<string, unknown>,
		userId: number,
	): Promise<RefurbIntake> {
		const { id } = await this.refurbishment(missionId);
		const known = new Set<string>([...FIELDS.map(([k]) => k), "tagTest"]);
		for (const k of Object.keys(input)) {
			if (!known.has(k)) throw new BadRequestException(`Unknown field "${k}".`);
		}
		const values = FIELDS.map(([key, , kind]) => {
			const v = coerce(key, kind, input[key]);
			return FLAGS.has(key) ? (v ?? false) : v;
		});
		const oldTagAssetId = values[
			FIELDS.findIndex(([k]) => k === "oldTagAssetId")
		] as number | null;
		const asObject = (v: unknown, name: string) => {
			if (v === undefined || v === null) return null;
			if (typeof v !== "object" || Array.isArray(v)) {
				throw new BadRequestException(`${name}: expected an object.`);
			}
			return v as Record<string, unknown>;
		};
		const tagTest = asObject(input.tagTest, "tagTest");
		if (tagTest && oldTagAssetId === null) {
			throw new BadRequestException("Choose the old Argos tag first.");
		}

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			await client.query(
				"SELECT 1 FROM refurbishments WHERE id = $1 FOR UPDATE",
				[id],
			);
			if (oldTagAssetId !== null) {
				const ok = await client.query(
					`SELECT 1 FROM assets a JOIN asset_types t ON t.id = a.asset_type_id
            WHERE a.id = $1 AND t.name = 'argos_tag'`,
					[oldTagAssetId],
				);
				if (ok.rows.length === 0) {
					throw new BadRequestException("That asset is not an Argos tag.");
				}
			}
			// The test readings go into the tag's measurement history, in this same
			// transaction, so a refused value leaves the logsheet untouched.
			const prior = await client.query(
				"SELECT old_tag_measurement_id FROM refurb_intake WHERE refurbishment_id = $1",
				[id],
			);
			let measurementId: number | null =
				prior.rows[0]?.old_tag_measurement_id ?? null;
			if (oldTagAssetId !== null && tagTest) {
				measurementId = await this.argos.saveTest(
					client,
					oldTagAssetId,
					tagTest,
					userId,
					measurementId,
				);
			}

			const columns = [...FIELDS.map(([, c]) => c), "old_tag_measurement_id"];
			const params = columns.map((_, i) => `$${i + 2}`);
			await client.query(
				`INSERT INTO refurb_intake (refurbishment_id, ${columns.join(", ")}, updated_by)
         VALUES ($1, ${params.join(", ")}, $${columns.length + 2})
         ON CONFLICT (refurbishment_id) DO UPDATE SET
           ${columns.map((c) => `${c} = EXCLUDED.${c}`).join(", ")},
           updated_by = EXCLUDED.updated_by, updated_at = now()`,
				[id, ...values, measurementId, userId],
			);
			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}
		return this.get(missionId);
	}

	// Why Intake is not complete yet (empty when it is).
	async blockers(missionId: number): Promise<string[]> {
		const n = await this.get(missionId);
		const missing: string[] = [];
		if (!n.issuesReviewed) missing.push("previous mission issues reviewed");
		if (n.oldTagAssetId === null) {
			missing.push("old Argos tag");
		} else {
			const test = this.argos.missingTest(n.tagTest);
			if (test.length > 0) missing.push(`tag test (${test.join(", ")})`);
		}
		if (!n.tagRemoved) missing.push("tag removed");
		if (!n.tagActivated) missing.push("tag activated");
		if (!n.tagStopped) missing.push("tag set to stop mode");
		return missing.length > 0 ? [`Intake: missing ${missing.join(", ")}.`] : [];
	}
}
