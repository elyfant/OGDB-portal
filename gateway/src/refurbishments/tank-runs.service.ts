import {
	BadRequestException,
	ConflictException,
	HttpException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { TankRun, TankRunCtReading, TankRunPitchPoint } from "@ogdb/types";
import type { Pool, PoolClient } from "pg";
import { PG_POOL } from "../db/db.constants";
import { type Kind, MAX_TEXT, coerce, isBlank } from "./field-coerce";

// The single table that maps a tank-run field to its column and says what
// kind of value it holds. The SELECT, the validation and the UPDATE are all
// generated from it, so a new field is one line here, one column in the
// migration and one in the shared type.
const FIELDS: ReadonlyArray<
	readonly [key: string, column: string, kind: Kind]
> = [
	["runDate", "run_date", "date"],
	["argosMounted", "argos_mounted", "bool"],
	["weightAirKg", "weight_air_kg", "num"],
	["pitchAd", "pitch_ad", "int"],
	["pitchCm", "pitch_cm", "num"],
	["rollAd", "roll_ad", "int"],
	["rollDeg", "roll_deg", "num"],
	["vbdAd", "vbd_ad", "int"],
	["vbdCc", "vbd_cc", "num"],
	["internalRh", "internal_rh", "num"],
	["internalTempC", "internal_temp_c", "num"],
	["internalPressurePsia", "internal_pressure_psia", "num"],
	["rollAngleDeg", "roll_angle_deg", "num"],
	["rollOk", "roll_ok", "bool"],
	["rollAdjustment", "roll_adjustment", "text"],
	["pitchAngleDeg", "pitch_angle_deg", "num"],
	["pitchOk", "pitch_ok", "bool"],
	["pitchAdjustment", "pitch_adjustment", "text"],
	["tankTempC", "tank_temp_c", "num"],
	["tankSalinityPsu", "tank_salinity_psu", "num"],
	["tankDensityKgm3", "tank_density_kgm3", "num"],
	["ctOk", "ct_ok", "bool"],
	["targetMaxDensityKgm3", "target_max_density_kgm3", "num"],
	["desiredTankWeightG", "desired_tank_weight_g", "num"],
	["measuredTankWeightG", "measured_tank_weight_g", "num"],
	["ballastChanges", "ballast_changes", "text"],
	["trimMassKg", "trim_mass_kg", "num"],
	["trimCVbdAd", "trim_c_vbd_ad", "int"],
	["trimCPitchAd", "trim_c_pitch_ad", "int"],
	["trimCRollAd", "trim_c_roll_ad", "int"],
	["notes", "notes", "text"],
];

// Needed before the final run can be signed off. Not required while the
// run is being filled in.
const SIGN_OFF_REQUIRED: ReadonlyArray<readonly [string, string]> = [
	["tankDensityKgm3", "tank density"],
	["desiredTankWeightG", "desired tank weight"],
	["measuredTankWeightG", "measured tank weight"],
	["rollOk", "roll check"],
	["pitchOk", "pitch check"],
	["ctOk", "CT check"],
	["trimMassKg", "$MASS (total weight in air)"],
	["trimCVbdAd", "VBD centre"],
	["trimCPitchAd", "pitch centre"],
	["trimCRollAd", "roll centre"],
];

function selectColumn([key, column, kind]: (typeof FIELDS)[number]): string {
	if (kind === "num") return `r.${column}::float8 AS "${key}"`;
	if (kind === "date") return `to_char(r.${column}, 'YYYY-MM-DD') AS "${key}"`;
	return `r.${column} AS "${key}"`;
}

const personName = (alias: string) =>
	`NULLIF(TRIM(${alias}.first_name || ' ' || ${alias}.last_name), '')`;

const SELECT_RUN = `
  SELECT
    r.id,
    r.refurbishment_id AS "refurbishmentId",
    r.run_number AS "runNumber",
    r.is_final AS "isFinal",
    ${FIELDS.map(selectColumn).join(",\n    ")},
    r.created_at AS "createdAt",
    ${personName("cc")} AS "createdByName",
    r.updated_at AS "updatedAt",
    ${personName("uc")} AS "updatedByName",
    r.signed_off_at AS "signedOffAt",
    ${personName("sc")} AS "signedOffByName"
  FROM refurb_tank_runs r
  LEFT JOIN users cu ON cu.id = r.created_by
  LEFT JOIN contacts cc ON cc.id = cu.contact_id
  LEFT JOIN users uu ON uu.id = r.updated_by
  LEFT JOIN contacts uc ON uc.id = uu.contact_id
  LEFT JOIN users su ON su.id = r.signed_off_by
  LEFT JOIN contacts sc ON sc.id = su.contact_id
`;

function parsePitchPoints(raw: unknown): TankRunPitchPoint[] {
	if (raw === undefined) return [];
	if (!Array.isArray(raw) || raw.length > 10) {
		throw new BadRequestException("pitchPoints: expected at most 10 points.");
	}
	return raw
		.filter((p) => !(isBlank(p?.pitchCm) && isBlank(p?.pitchDeg)))
		.map((p) => {
			const cm = coerce("pitchPoints.pitchCm", "num", p?.pitchCm);
			const deg = coerce("pitchPoints.pitchDeg", "num", p?.pitchDeg);
			if (cm === null || deg === null) {
				throw new BadRequestException(
					"Each pitch point needs both a position (cm) and an angle (deg).",
				);
			}
			return { pitchCm: cm as number, pitchDeg: deg as number };
		});
}

function parseCtReadings(raw: unknown): TankRunCtReading[] {
	if (raw === undefined) return [];
	if (!Array.isArray(raw) || raw.length > 10) {
		throw new BadRequestException("ctReadings: expected at most 10 readings.");
	}
	const seen = new Set<string>();
	return raw
		.filter(
			(c) =>
				!(
					isBlank(c?.sensorLabel) &&
					isBlank(c?.tempC) &&
					isBlank(c?.salinityPsu)
				),
		)
		.map((c) => {
			const label =
				typeof c?.sensorLabel === "string" ? c.sensorLabel.trim() : "";
			if (!label) {
				throw new BadRequestException("Each CT reading needs a sensor name.");
			}
			if (seen.has(label)) {
				throw new BadRequestException(`CT sensor "${label}" is listed twice.`);
			}
			seen.add(label);
			return {
				sensorLabel: label,
				tempC: coerce("ctReadings.tempC", "num", c?.tempC) as number | null,
				salinityPsu: coerce("ctReadings.salinityPsu", "num", c?.salinityPsu) as
					| number
					| null,
			};
		});
}

// Out-of-range numbers and CHECK failures are the tech's typo, not a
// server fault: say so with a 400.
function mapDbError(err: unknown): never {
	if (err instanceof HttpException) throw err;
	const e = err as { code?: string; constraint?: string };
	if (e.code === "23514") {
		throw new BadRequestException(
			`A value is out of range (${e.constraint ?? "check failed"}). Density must be in kg/m3 (about 1000-1030), humidity 0-100.`,
		);
	}
	if (e.code === "22003") {
		throw new BadRequestException("A number is too large for its field.");
	}
	throw err;
}

@Injectable()
export class TankRunsService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	private async refurbishmentIdForMission(missionId: number): Promise<number> {
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

	private async load(
		db: Pool | PoolClient,
		refurbishmentId: number,
		runId?: number,
	): Promise<TankRun[]> {
		const runs = await db.query(
			`${SELECT_RUN} WHERE r.refurbishment_id = $1 ${runId ? "AND r.id = $2" : ""}
       ORDER BY r.run_number`,
			runId ? [refurbishmentId, runId] : [refurbishmentId],
		);
		if (runs.rows.length === 0) return [];
		const ids = runs.rows.map((r) => r.id);
		const [points, cts] = await Promise.all([
			db.query(
				`SELECT tank_run_id AS "runId", pitch_cm::float8 AS "pitchCm",
                pitch_deg::float8 AS "pitchDeg"
           FROM refurb_tank_run_pitch_points
          WHERE tank_run_id = ANY($1) ORDER BY tank_run_id, point_no`,
				[ids],
			),
			db.query(
				`SELECT tank_run_id AS "runId", sensor_label AS "sensorLabel",
                temp_c::float8 AS "tempC", salinity_psu::float8 AS "salinityPsu"
           FROM refurb_tank_run_ct_readings
          WHERE tank_run_id = ANY($1) ORDER BY tank_run_id, id`,
				[ids],
			),
		]);
		return runs.rows.map((r) => ({
			...r,
			pitchPoints: points.rows
				.filter((p) => p.runId === r.id)
				.map(({ pitchCm, pitchDeg }) => ({ pitchCm, pitchDeg })),
			ctReadings: cts.rows
				.filter((c) => c.runId === r.id)
				.map(({ sensorLabel, tempC, salinityPsu }) => ({
					sensorLabel,
					tempC,
					salinityPsu,
				})),
		}));
	}

	async list(missionId: number): Promise<TankRun[]> {
		return this.load(
			this.pool,
			await this.refurbishmentIdForMission(missionId),
		);
	}

	// A new, empty run with the next number. The date defaults to today.
	async create(missionId: number, userId: number): Promise<TankRun> {
		const refurbId = await this.refurbishmentIdForMission(missionId);
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			// Serialise concurrent "Add run" clicks from two techs on the same
			// logsheet, so they get Run 2 and Run 3, not a unique violation.
			await client.query(
				"SELECT 1 FROM refurbishments WHERE id = $1 FOR UPDATE",
				[refurbId],
			);
			const inserted = await client.query(
				`INSERT INTO refurb_tank_runs (refurbishment_id, run_number, created_by, updated_by)
         VALUES ($1,
                 COALESCE((SELECT MAX(run_number) FROM refurb_tank_runs WHERE refurbishment_id = $1), 0) + 1,
                 $2, $2)
         RETURNING id`,
				[refurbId, userId],
			);
			const [run] = await this.load(client, refurbId, inserted.rows[0].id);
			await client.query("COMMIT");
			return run;
		} catch (err) {
			await client.query("ROLLBACK");
			return mapDbError(err);
		} finally {
			client.release();
		}
	}

	async update(
		missionId: number,
		runId: number,
		input: Record<string, unknown>,
		userId: number,
	): Promise<TankRun> {
		const refurbId = await this.refurbishmentIdForMission(missionId);

		const known = new Set([
			...FIELDS.map(([k]) => k),
			"isFinal",
			"pitchPoints",
			"ctReadings",
		]);
		for (const k of Object.keys(input)) {
			if (!known.has(k)) throw new BadRequestException(`Unknown field "${k}".`);
		}
		const isFinal = input.isFinal;
		if (isFinal !== undefined && typeof isFinal !== "boolean") {
			throw new BadRequestException("isFinal: expected true or false.");
		}
		const sets: string[] = [];
		const params: unknown[] = [];
		for (const [key, column, kind] of FIELDS) {
			if (!(key in input)) continue;
			params.push(coerce(key, kind, input[key]));
			sets.push(`${column} = $${params.length}`);
		}
		const pitchPoints =
			"pitchPoints" in input ? parsePitchPoints(input.pitchPoints) : null;
		const ctReadings =
			"ctReadings" in input ? parseCtReadings(input.ctReadings) : null;

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			const existing = await client.query(
				"SELECT is_final FROM refurb_tank_runs WHERE id = $1 AND refurbishment_id = $2 FOR UPDATE",
				[runId, refurbId],
			);
			if (existing.rows.length === 0) {
				throw new NotFoundException(`Tank run ${runId} not found.`);
			}
			if (isFinal === true) {
				// Only one final run. Whatever was final loses that status, and
				// its sign-off with it (a sign-off belongs to the final run).
				await client.query(
					`UPDATE refurb_tank_runs
              SET is_final = false, signed_off_at = NULL, signed_off_by = NULL
            WHERE refurbishment_id = $1 AND id <> $2 AND is_final`,
					[refurbId, runId],
				);
			}
			if (isFinal !== undefined) {
				params.push(isFinal);
				sets.push(`is_final = $${params.length}`);
			}
			// Any edit to a signed-off run withdraws the sign-off: what was
			// signed is no longer what is on the page.
			sets.push("signed_off_at = NULL", "signed_off_by = NULL");
			params.push(userId);
			sets.push(`updated_by = $${params.length}`, "updated_at = now()");
			params.push(runId);
			await client.query(
				`UPDATE refurb_tank_runs SET ${sets.join(", ")} WHERE id = $${params.length}`,
				params,
			);
			if (pitchPoints) {
				await client.query(
					"DELETE FROM refurb_tank_run_pitch_points WHERE tank_run_id = $1",
					[runId],
				);
				for (const [i, p] of pitchPoints.entries()) {
					await client.query(
						`INSERT INTO refurb_tank_run_pitch_points (tank_run_id, point_no, pitch_cm, pitch_deg)
             VALUES ($1, $2, $3, $4)`,
						[runId, i + 1, p.pitchCm, p.pitchDeg],
					);
				}
			}
			if (ctReadings) {
				await client.query(
					"DELETE FROM refurb_tank_run_ct_readings WHERE tank_run_id = $1",
					[runId],
				);
				for (const c of ctReadings) {
					await client.query(
						`INSERT INTO refurb_tank_run_ct_readings (tank_run_id, sensor_label, temp_c, salinity_psu)
             VALUES ($1, $2, $3, $4)`,
						[runId, c.sensorLabel, c.tempC, c.salinityPsu],
					);
				}
			}
			const [run] = await this.load(client, refurbId, runId);
			await client.query("COMMIT");
			return run;
		} catch (err) {
			await client.query("ROLLBACK");
			return mapDbError(err);
		} finally {
			client.release();
		}
	}

	// Tech sign-off of the final run. Refuses until everything the glider's
	// trim depends on has been entered.
	async signOff(
		missionId: number,
		runId: number,
		userId: number,
	): Promise<TankRun> {
		const refurbId = await this.refurbishmentIdForMission(missionId);
		const [run] = await this.load(this.pool, refurbId, runId);
		if (!run) throw new NotFoundException(`Tank run ${runId} not found.`);
		if (!run.isFinal) {
			throw new ConflictException(
				"Only the final run can be signed off. Mark this run as final first.",
			);
		}
		const missing = SIGN_OFF_REQUIRED.filter(
			([key]) => (run as unknown as Record<string, unknown>)[key] === null,
		).map(([, label]) => label);
		if (missing.length > 0) {
			throw new BadRequestException(
				`Cannot sign off yet. Missing: ${missing.join(", ")}.`,
			);
		}
		await this.pool.query(
			`UPDATE refurb_tank_runs
          SET signed_off_at = now(), signed_off_by = $1
        WHERE id = $2`,
			[userId, runId],
		);
		const [signed] = await this.load(this.pool, refurbId, runId);
		return signed;
	}

	async remove(missionId: number, runId: number): Promise<void> {
		const refurbId = await this.refurbishmentIdForMission(missionId);
		const [run] = await this.load(this.pool, refurbId, runId);
		if (!run) throw new NotFoundException(`Tank run ${runId} not found.`);
		if (run.signedOffAt) {
			throw new ConflictException(
				"A signed-off run can't be deleted. Mark another run final instead.",
			);
		}
		await this.pool.query("DELETE FROM refurb_tank_runs WHERE id = $1", [
			runId,
		]);
	}
}
