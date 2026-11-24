import {
	BadRequestException,
	HttpException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { RefurbVacuum } from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import { type Kind, coerce } from "./field-coerce";

// field -> column -> kind. The SELECT and the upsert are generated from it.
const FIELDS: ReadonlyArray<readonly [string, string, Kind]> = [
	["cablesChecked", "cables_checked", "bool"],
	["oringsServiced", "orings_serviced", "bool"],
	["gliderClosed", "glider_closed", "bool"],
	["vacuumPulled", "vacuum_pulled", "bool"],
	["pressureBeforePsia", "pressure_before_psia", "num"],
	["pressurePulledPsia", "pressure_pulled_psia", "num"],
	["pressureSettledPsia", "pressure_settled_psia", "num"],
	["humidityRh", "humidity_rh", "num"],
	["anodeContinuityOk", "anode_continuity_ok", "bool"],
	["notes", "notes", "text"],
];

const STEP_BOXES = [
	"cablesChecked",
	"oringsServiced",
	"gliderClosed",
	"vacuumPulled",
];

const personName = (alias: string) =>
	`NULLIF(TRIM(${alias}.first_name || ' ' || ${alias}.last_name), '')`;

@Injectable()
export class VacuumService {
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

	async get(missionId: number): Promise<RefurbVacuum> {
		const id = await this.refurbishmentId(missionId);
		const cols = FIELDS.map(([key, column, kind]) =>
			kind === "num"
				? `v.${column}::float8 AS "${key}"`
				: `v.${column} AS "${key}"`,
		).join(", ");
		const r = await this.pool.query(
			`SELECT ${cols}, v.updated_at AS "updatedAt",
              ${personName("uc")} AS "updatedByName"
         FROM refurb_vacuum v
         LEFT JOIN users uu ON uu.id = v.updated_by
         LEFT JOIN contacts uc ON uc.id = uu.contact_id
        WHERE v.refurbishment_id = $1`,
			[id],
		);
		if (r.rows[0]) return r.rows[0];
		// Nothing saved yet: every step undone, every reading empty.
		return {
			cablesChecked: false,
			oringsServiced: false,
			gliderClosed: false,
			vacuumPulled: false,
			pressureBeforePsia: null,
			pressurePulledPsia: null,
			pressureSettledPsia: null,
			humidityRh: null,
			anodeContinuityOk: null,
			notes: null,
			updatedAt: null,
			updatedByName: null,
		};
	}

	// Saves the whole section. Every field is written, so a field left out
	// is cleared; the form always sends all of them.
	async save(
		missionId: number,
		input: Record<string, unknown>,
		userId: number,
	): Promise<RefurbVacuum> {
		const id = await this.refurbishmentId(missionId);
		const known = new Set(FIELDS.map(([k]) => k));
		for (const k of Object.keys(input)) {
			if (!known.has(k)) throw new BadRequestException(`Unknown field "${k}".`);
		}
		const values = FIELDS.map(([key, , kind]) => {
			const v = coerce(key, kind, input[key]);
			// The step boxes are never "unknown": not ticked means false.
			return STEP_BOXES.includes(key) ? (v ?? false) : v;
		});
		const columns = FIELDS.map(([, c]) => c);
		const params = columns.map((_, i) => `$${i + 2}`);
		try {
			await this.pool.query(
				`INSERT INTO refurb_vacuum (refurbishment_id, ${columns.join(", ")}, updated_by)
         VALUES ($1, ${params.join(", ")}, $${columns.length + 2})
         ON CONFLICT (refurbishment_id) DO UPDATE SET
           ${columns.map((c) => `${c} = EXCLUDED.${c}`).join(", ")},
           updated_by = EXCLUDED.updated_by, updated_at = now()`,
				[id, ...values, userId],
			);
		} catch (err) {
			if (err instanceof HttpException) throw err;
			const e = err as { code?: string };
			if (e.code === "23514" || e.code === "22003") {
				throw new BadRequestException(
					"A value is out of range. Pressures are in psia (about 14 before pulling, about 9 after) and humidity is 0-100 %.",
				);
			}
			throw err;
		}
		return this.get(missionId);
	}

	// Why Close and vacuum is not complete yet (empty when it is).
	async blockers(missionId: number): Promise<string[]> {
		const v = await this.get(missionId);
		if (v.anodeContinuityOk === false) {
			return ["Close and vacuum: anode continuity failed."];
		}
		const missing: string[] = [];
		if (!v.cablesChecked) missing.push("cables check");
		if (!v.oringsServiced) missing.push("o-rings");
		if (!v.gliderClosed) missing.push("close glider");
		if (!v.vacuumPulled) missing.push("pull vacuum");
		if (v.pressurePulledPsia === null) missing.push("pulled pressure");
		if (v.pressureSettledPsia === null) missing.push("settled pressure");
		if (v.anodeContinuityOk === null) missing.push("anode continuity");
		return missing.length > 0
			? [`Close and vacuum: missing ${missing.join(", ")}.`]
			: [];
	}
}
