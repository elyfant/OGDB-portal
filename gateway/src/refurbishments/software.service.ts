import {
	BadRequestException,
	HttpException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	RefurbSoftware,
	RefurbSoftwareCleanup,
	SoftwareCleanupStage,
	SoftwareCleanupTarget,
} from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import { type Kind, coerce } from "./field-coerce";

// Every cleanup step, in checklist order: each stage asks for the same five.
const STAGES: readonly SoftwareCleanupStage[] = [
	"after_previous_mission",
	"after_simdives",
];
const TARGETS: readonly SoftwareCleanupTarget[] = [
	"backup",
	"basestation",
	"gliders",
	"glider",
	"gp",
];
const TARGET_LABELS: Record<SoftwareCleanupTarget, string> = {
	backup: "backup on gliderbak",
	basestation: "basestation",
	gliders: "gliders server",
	glider: "glider server",
	gp: "gp server",
};

// field -> column -> kind. The SELECT and the upsert are generated from it.
const FIELDS: ReadonlyArray<readonly [string, string, Kind]> = [
	["flashcardCopied", "flashcard_copied", "bool"],
	["flashcardFormatted", "flashcard_formatted", "bool"],
	["simdiveCmdfileUploaded", "simdive_cmdfile_uploaded", "bool"],
	["simdiveScienceUploaded", "simdive_science_uploaded", "bool"],
	["simdiveDives", "simdive_dives", "int"],
	["simdiveDataOk", "simdive_data_ok", "bool"],
	["simdiveGliderOff", "simdive_glider_off", "bool"],
	["simdiveNotes", "simdive_notes", "text"],
	["filesScience", "files_science", "bool"],
	["filesCmdfile", "files_cmdfile", "bool"],
	["filesTargets", "files_targets", "bool"],
	["filesCalibConstants", "files_calib_constants", "bool"],
	["filesPagersUrlsLogout", "files_pagers_urls_logout", "bool"],
	["filesOther", "files_other", "text"],
];

const personName = (alias: string) =>
	`NULLIF(TRIM(${alias}.first_name || ' ' || ${alias}.last_name), '')`;

@Injectable()
export class SoftwareService {
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

	async get(missionId: number): Promise<RefurbSoftware> {
		const id = await this.refurbishmentId(missionId);
		const cols = FIELDS.map(([key, column]) => `s.${column} AS "${key}"`).join(
			", ",
		);
		const [row, done] = await Promise.all([
			this.pool.query(
				`SELECT ${cols}, s.updated_at AS "updatedAt",
                ${personName("uc")} AS "updatedByName"
           FROM refurb_software s
           LEFT JOIN users uu ON uu.id = s.updated_by
           LEFT JOIN contacts uc ON uc.id = uu.contact_id
          WHERE s.refurbishment_id = $1`,
				[id],
			),
			this.pool.query(
				`SELECT c.stage, c.target, c.done_at AS "doneAt",
                ${personName("dc")} AS "doneByName"
           FROM refurb_software_cleanups c
           LEFT JOIN users du ON du.id = c.done_by
           LEFT JOIN contacts dc ON dc.id = du.contact_id
          WHERE c.refurbishment_id = $1`,
				[id],
			),
		]);

		const doneBy = new Map(done.rows.map((r) => [`${r.stage}/${r.target}`, r]));
		const cleanups: RefurbSoftwareCleanup[] = STAGES.flatMap((stage) =>
			TARGETS.map((target) => {
				const r = doneBy.get(`${stage}/${target}`);
				return {
					stage,
					target,
					done: Boolean(r),
					doneAt: r?.doneAt ?? null,
					doneByName: r?.doneByName ?? null,
				};
			}),
		);

		const saved = row.rows[0] ?? {
			updatedAt: null,
			updatedByName: null,
			...Object.fromEntries(
				FIELDS.map(([key, , kind]) => [key, kind === "bool" ? false : null]),
			),
		};
		return { ...saved, cleanups };
	}

	// Saves the whole section: the sim-dive and mission-file fields (all of
	// them are written), plus any cleanup ticks that changed. Ticking an
	// already-ticked step keeps the first person's name and time.
	async save(
		missionId: number,
		input: Record<string, unknown>,
		userId: number,
	): Promise<RefurbSoftware> {
		const id = await this.refurbishmentId(missionId);
		const known = new Set<string>([...FIELDS.map(([k]) => k), "cleanups"]);
		for (const k of Object.keys(input)) {
			if (!known.has(k)) throw new BadRequestException(`Unknown field "${k}".`);
		}
		const values = FIELDS.map(([key, , kind]) => {
			const v = coerce(key, kind, input[key]);
			return kind === "bool" ? (v ?? false) : v;
		});

		const toggles: { stage: string; target: string; done: boolean }[] = [];
		if (input.cleanups !== undefined) {
			if (!Array.isArray(input.cleanups) || input.cleanups.length > 20) {
				throw new BadRequestException("cleanups: expected a list of steps.");
			}
			for (const c of input.cleanups) {
				if (
					!STAGES.includes(c?.stage) ||
					!TARGETS.includes(c?.target) ||
					typeof c?.done !== "boolean"
				) {
					throw new BadRequestException(
						"cleanups: each step needs a stage, a target and done true or false.",
					);
				}
				toggles.push({ stage: c.stage, target: c.target, done: c.done });
			}
		}

		const columns = FIELDS.map(([, c]) => c);
		const params = columns.map((_, i) => `$${i + 2}`);
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			await client.query(
				`INSERT INTO refurb_software (refurbishment_id, ${columns.join(", ")}, updated_by)
         VALUES ($1, ${params.join(", ")}, $${columns.length + 2})
         ON CONFLICT (refurbishment_id) DO UPDATE SET
           ${columns.map((c) => `${c} = EXCLUDED.${c}`).join(", ")},
           updated_by = EXCLUDED.updated_by, updated_at = now()`,
				[id, ...values, userId],
			);
			for (const t of toggles) {
				if (t.done) {
					await client.query(
						`INSERT INTO refurb_software_cleanups (refurbishment_id, stage, target, done_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (refurbishment_id, stage, target) DO NOTHING`,
						[id, t.stage, t.target, userId],
					);
				} else {
					await client.query(
						`DELETE FROM refurb_software_cleanups
              WHERE refurbishment_id = $1 AND stage = $2 AND target = $3`,
						[id, t.stage, t.target],
					);
				}
			}
			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			if (err instanceof HttpException) throw err;
			const e = err as { code?: string; constraint?: string };
			if (
				e.code === "23514" &&
				e.constraint === "ck_refurb_software_flashcard_order"
			) {
				throw new BadRequestException(
					"Copy the old files off the flash card before formatting it: formatting destroys them.",
				);
			}
			if (e.code === "23514" || e.code === "22003") {
				throw new BadRequestException(
					"A value is out of range. The number of sim dives must be between 0 and 100.",
				);
			}
			throw err;
		} finally {
			client.release();
		}
		return this.get(missionId);
	}

	// Why the Software track is not complete yet (empty when it is).
	async blockers(missionId: number): Promise<string[]> {
		const s = await this.get(missionId);
		const out: string[] = [];

		const missingIn = (stage: SoftwareCleanupStage) =>
			s.cleanups
				.filter((c) => c.stage === stage && !c.done)
				.map((c) => TARGET_LABELS[c.target]);

		const flashcard: string[] = [];
		if (!s.flashcardCopied) flashcard.push("old files copied off");
		if (!s.flashcardFormatted) flashcard.push("card formatted");
		if (flashcard.length > 0) {
			out.push(`Flash card: ${flashcard.join(", ")} not confirmed.`);
		}

		const before = missingIn("after_previous_mission");
		if (before.length > 0) {
			out.push(
				`Software track: not confirmed clean after the previous mission: ${before.join(", ")}.`,
			);
		}

		const simdive: string[] = [];
		if (!s.simdiveCmdfileUploaded) simdive.push("cmdfile upload");
		if (!s.simdiveScienceUploaded) simdive.push("science file upload");
		if (!s.simdiveDives) simdive.push("completed dives");
		if (!s.simdiveDataOk) simdive.push("dive data check");
		if (!s.simdiveGliderOff) simdive.push("glider turned off");
		if (simdive.length > 0) {
			out.push(`Sim dives: missing ${simdive.join(", ")}.`);
		}

		const after = missingIn("after_simdives");
		if (after.length > 0) {
			out.push(
				`Software track: not confirmed clean after the sim dives: ${after.join(", ")}.`,
			);
		}

		const files: string[] = [];
		if (!s.filesScience) files.push("science");
		if (!s.filesCmdfile) files.push("cmdfile");
		if (!s.filesTargets) files.push("targets");
		if (!s.filesCalibConstants) files.push("sg_calib_constants.m");
		if (!s.filesPagersUrlsLogout) files.push(".pagers/.urls/.logout");
		if (files.length > 0) {
			out.push(`Mission files: missing ${files.join(", ")}.`);
		}
		return out;
	}
}
