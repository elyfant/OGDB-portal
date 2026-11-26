import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	RefurbSectionKey,
	RefurbSectionState,
	Refurbishment,
} from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import { fetchFlaggedInBuild } from "../gliders/build.helpers";
import { BatteriesService } from "./batteries.service";
import { DeviceTestsService } from "./device-tests.service";
import { FinalPrepService } from "./final-prep.service";
import { InspectionService } from "./inspection.service";
import { IntakeService } from "./intake.service";
import { SensorsService } from "./sensors.service";
import { SoftwareService } from "./software.service";
import { TestLinksService } from "./test-links.service";
import { VacuumService } from "./vacuum.service";

// The refurbishment header joined to its mission's glider. Identity (name,
// serial number) is read from the glider, never stored on the logsheet.
const SELECT_REFURBISHMENT = `
  SELECT
    r.id,
    r.mission_id AS "missionId",
    r.form_version AS "formVersion",
    m.glider_asset_id AS "gliderAssetId",
    agd.glider_name AS "gliderName",
    a.serial_number AS "serialNumber",
    r.started_at AS "startedAt",
    NULLIF(TRIM(sc.first_name || ' ' || sc.last_name), '') AS "startedByName",
    r.cleared_at AS "clearedAt",
    NULLIF(TRIM(cc.first_name || ' ' || cc.last_name), '') AS "clearedByName"
  FROM refurbishments r
  JOIN missions m ON m.id = r.mission_id
  JOIN assets a ON a.id = m.glider_asset_id
  JOIN asset_glider_details agd ON agd.asset_id = a.id
  LEFT JOIN users su ON su.id = r.started_by
  LEFT JOIN contacts sc ON sc.id = su.contact_id
  LEFT JOIN users cu ON cu.id = r.cleared_by
  LEFT JOIN contacts cc ON cc.id = cu.contact_id
`;

// The logsheet's sections, in the order they appear. `required` ones must be
// complete before the glider can be cleared to deploy; the field test never is.
const SECTIONS: ReadonlyArray<{ key: RefurbSectionKey; required: boolean }> = [
	{ key: "intake", required: true },
	{ key: "inspections", required: true },
	{ key: "sensors", required: true },
	{ key: "batteries", required: true },
	{ key: "device_tests", required: true },
	{ key: "vacuum", required: true },
	{ key: "tank_test", required: true },
	{ key: "selftest", required: true },
	{ key: "software", required: true },
	{ key: "field_test", required: false },
	{ key: "final_prep", required: true },
];

// Has anyone recorded anything in each section yet? One query, one EXISTS per
// section, so the progress bar can tell "in progress" from "not started".
// Names used in messages. The page has its own, numbered, titles.
const SECTION_TITLES: Record<RefurbSectionKey, string> = {
	intake: "Intake",
	inspections: "Inspections",
	sensors: "Sensors",
	batteries: "Batteries",
	device_tests: "Device tests",
	vacuum: "Close and vacuum",
	tank_test: "Tank test",
	selftest: "Selftest",
	software: "Software track",
	field_test: "Field test",
	final_prep: "Final prep",
};

const SELECT_STARTED = `
  SELECT
    EXISTS (SELECT 1 FROM refurb_intake WHERE refurbishment_id = $1) AS intake,
    EXISTS (SELECT 1 FROM refurb_inspection_items
             WHERE refurbishment_id = $1 AND status IS NOT NULL) AS inspections,
    (EXISTS (SELECT 1 FROM refurb_sensor_swaps WHERE refurbishment_id = $1)
     OR EXISTS (SELECT 1 FROM refurb_sensor_checks WHERE refurbishment_id = $1)) AS sensors,
    (EXISTS (SELECT 1 FROM refurb_battery_changes WHERE refurbishment_id = $1)
     OR EXISTS (SELECT 1 FROM refurb_battery_checks WHERE refurbishment_id = $1)) AS batteries,
    EXISTS (SELECT 1 FROM refurb_device_tests
             WHERE refurbishment_id = $1 AND result IS NOT NULL) AS device_tests,
    EXISTS (SELECT 1 FROM refurb_vacuum WHERE refurbishment_id = $1) AS vacuum,
    EXISTS (SELECT 1 FROM refurb_tank_runs WHERE refurbishment_id = $1) AS tank_test,
    (EXISTS (SELECT 1 FROM refurb_test_links WHERE refurbishment_id = $1 AND kind = 'selftest')
     OR EXISTS (SELECT 1 FROM refurb_test_confirmations
                 WHERE refurbishment_id = $1 AND kind = 'selftest')) AS selftest,
    (EXISTS (SELECT 1 FROM refurb_software WHERE refurbishment_id = $1)
     OR EXISTS (SELECT 1 FROM refurb_software_cleanups WHERE refurbishment_id = $1)) AS software,
    (EXISTS (SELECT 1 FROM refurb_test_links WHERE refurbishment_id = $1 AND kind = 'field_test')
     OR EXISTS (SELECT 1 FROM refurb_test_confirmations
                 WHERE refurbishment_id = $1 AND kind = 'field_test')) AS field_test,
    EXISTS (SELECT 1 FROM refurb_final_prep WHERE refurbishment_id = $1) AS final_prep
`;

@Injectable()
export class RefurbishmentsService {
	constructor(
		@Inject(PG_POOL) private readonly pool: Pool,
		private readonly batteries: BatteriesService,
		private readonly deviceTests: DeviceTestsService,
		private readonly vacuum: VacuumService,
		private readonly inspection: InspectionService,
		private readonly finalPrep: FinalPrepService,
		private readonly software: SoftwareService,
		private readonly intake: IntakeService,
		private readonly testLinks: TestLinksService,
		private readonly sensors: SensorsService,
	) {}

	private async tankBlockers(refurbishmentId: number): Promise<string[]> {
		const r = await this.pool.query(
			`SELECT 1 FROM refurb_tank_runs
        WHERE refurbishment_id = $1 AND is_final AND signed_off_at IS NOT NULL`,
			[refurbishmentId],
		);
		return r.rows.length === 0 ? ["Tank test: no signed-off final run."] : [];
	}

	// What is still to do in each section. A section is complete when nothing
	// is left to do in it AND someone has recorded something there, so a
	// section nobody has touched never shows as done.
	private async sectionStates(
		refurbishmentId: number,
		missionId: number,
	): Promise<RefurbSectionState[]> {
		const [started, edits, ...blockers] = await Promise.all([
			this.pool.query(SELECT_STARTED, [refurbishmentId]),
			this.pool.query(
				`SELECT e.section, e.edited_at AS "editedAt",
                NULLIF(TRIM(c.first_name || ' ' || c.last_name), '') AS "editedByName"
           FROM refurb_section_edits e
           LEFT JOIN users u ON u.id = e.edited_by
           LEFT JOIN contacts c ON c.id = u.contact_id
          WHERE e.refurbishment_id = $1`,
				[refurbishmentId],
			),
			this.intake.blockers(missionId),
			this.inspection.blockers(missionId),
			this.sensors.blockers(missionId),
			this.batteries.blockers(missionId),
			this.deviceTests.blockers(missionId),
			this.vacuum.blockers(missionId),
			this.tankBlockers(refurbishmentId),
			this.testLinks.blockers(missionId),
			this.software.blockers(missionId),
			Promise.resolve([] as string[]), // field test: never blocks
			this.finalPrep.blockers(missionId),
		]);
		const startedRow = started.rows[0] as Record<string, boolean>;
		const editBy = new Map(edits.rows.map((e) => [e.section, e]));
		return SECTIONS.map(({ key, required }, i) => ({
			key,
			required,
			started: Boolean(startedRow[key]),
			blockers: blockers[i] as string[],
			complete:
				(blockers[i] as string[]).length === 0 && Boolean(startedRow[key]),
			lastEditedAt: editBy.get(key)?.editedAt ?? null,
			lastEditedByName: editBy.get(key)?.editedByName ?? null,
		}));
	}

	async findByMission(missionId: number): Promise<Refurbishment | null> {
		const result = await this.pool.query(
			`${SELECT_REFURBISHMENT} WHERE r.mission_id = $1`,
			[missionId],
		);
		const row = result.rows[0];
		if (!row) return null;
		const [sections, history] = await Promise.all([
			this.sectionStates(row.id, missionId),
			this.pool.query(
				`SELECT l.id, l.action, l.at, l.reason,
                NULLIF(TRIM(c.first_name || ' ' || c.last_name), '') AS "byName"
           FROM refurb_clearance_log l
           LEFT JOIN users u ON u.id = l.by_user
           LEFT JOIN contacts c ON c.id = u.contact_id
          WHERE l.refurbishment_id = $1
          ORDER BY l.at DESC, l.id DESC`,
				[row.id],
			),
		]);
		return {
			...row,
			sections,
			clearanceHistory: history.rows,
			// Cleared to deploy needs every required section complete. Nothing left
			// to do is not enough on its own: an untouched section blocks too.
			clearBlockers: sections
				.filter((sec) => sec.required)
				.flatMap((sec) =>
					sec.blockers.length > 0
						? sec.blockers
						: sec.complete
							? []
							: [`${SECTION_TITLES[sec.key]}: not started.`],
				),
		};
	}

	// Clears the glider for deployment and LOCKS the logsheet. Refused unless every
	// required section is complete, so the page cannot be tricked into it. The
	// person clearing it is recorded (the operator), and the event is logged.
	async clear(missionId: number, userId: number): Promise<Refurbishment> {
		const current = await this.findByMission(missionId);
		if (!current) {
			throw new NotFoundException(
				`Mission ${missionId} has no refurbishment logsheet.`,
			);
		}
		if (current.clearedAt) {
			throw new ConflictException(
				"This logsheet is already cleared and locked.",
			);
		}
		// "Servicing required" means DO NOT DEPLOY: the glider, or anything in
		// its build, flagged for serious repair can't be cleared to deploy until
		// that is resolved.
		const flagged = await fetchFlaggedInBuild(this.pool, missionId);
		if (flagged.length > 0) {
			throw new ConflictException(
				`Can't clear for deployment while servicing is required: ${flagged
					.map((f) => `${f.label}${f.title ? ` (${f.title})` : ""}`)
					.join(", ")}. Resolve it first.`,
			);
		}
		const open = current.sections.filter((s) => s.required && !s.complete);
		if (open.length > 0) {
			throw new ConflictException(
				`Not every required section is done yet: ${open
					.map((s) => SECTION_TITLES[s.key])
					.join(", ")}.`,
			);
		}
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			// "AND cleared_at IS NULL" makes two people clicking at once safe: the
			// second finds it already cleared.
			const res = await client.query(
				`UPDATE refurbishments SET cleared_by = $1, cleared_at = now()
          WHERE id = $2 AND cleared_at IS NULL`,
				[userId, current.id],
			);
			if (res.rowCount === 0) {
				throw new ConflictException(
					"This logsheet is already cleared and locked.",
				);
			}
			await client.query(
				`INSERT INTO refurb_clearance_log (refurbishment_id, action, by_user)
         VALUES ($1, 'cleared', $2)`,
				[current.id, userId],
			);
			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}
		const cleared = await this.findByMission(missionId);
		if (!cleared) throw new NotFoundException("Refurbishment not found.");
		return cleared;
	}

	// Unlocks a cleared logsheet so it can be edited again. That withdraws the
	// clearance (it has to be given again), needs a reason, and is logged.
	async unlock(
		missionId: number,
		reason: unknown,
		userId: number,
	): Promise<Refurbishment> {
		const why = typeof reason === "string" ? reason.trim() : "";
		if (why.length < 3) {
			throw new BadRequestException("Say why it is being unlocked.");
		}
		if (why.length > 500) {
			throw new BadRequestException("The reason is over 500 characters.");
		}
		const current = await this.findByMission(missionId);
		if (!current) {
			throw new NotFoundException(
				`Mission ${missionId} has no refurbishment logsheet.`,
			);
		}
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			const res = await client.query(
				`UPDATE refurbishments SET cleared_by = NULL, cleared_at = NULL
          WHERE id = $1 AND cleared_at IS NOT NULL`,
				[current.id],
			);
			if (res.rowCount === 0) {
				throw new ConflictException(
					"This logsheet is not cleared, so it is not locked.",
				);
			}
			await client.query(
				`INSERT INTO refurb_clearance_log (refurbishment_id, action, by_user, reason)
         VALUES ($1, 'unlocked', $2, $3)`,
				[current.id, userId, why],
			);
			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}
		const unlocked = await this.findByMission(missionId);
		if (!unlocked) throw new NotFoundException("Refurbishment not found.");
		return unlocked;
	}

	async start(missionId: number, userId: number): Promise<Refurbishment> {
		const mission = await this.pool.query(
			`SELECT m.id, s.name AS status, p.name AS platform
         FROM missions m
         JOIN status s ON s.id = m.status_id
         LEFT JOIN assets a ON a.id = m.glider_asset_id
         LEFT JOIN asset_glider_details agd ON agd.asset_id = a.id
         LEFT JOIN platforms p ON p.id = agd.platform_id
        WHERE m.id = $1`,
			[missionId],
		);
		const row = mission.rows[0];
		if (!row) throw new NotFoundException(`Mission ${missionId} not found.`);
		if (row.platform !== "seaglider") {
			throw new BadRequestException(
				"The refurbishment logsheet is for Seagliders only.",
			);
		}
		if (row.status !== "workshop" && row.status !== "scheduled") {
			throw new BadRequestException(
				"A refurbishment can only be started on a workshop or scheduled mission.",
			);
		}
		try {
			await this.pool.query(
				"INSERT INTO refurbishments (mission_id, started_by) VALUES ($1, $2)",
				[missionId, userId],
			);
		} catch (err) {
			if ((err as { code?: string }).code === "23505") {
				throw new ConflictException(
					"This mission already has a refurbishment logsheet.",
				);
			}
			throw err;
		}
		const created = await this.findByMission(missionId);
		if (!created) throw new NotFoundException("Refurbishment not found.");
		return created;
	}
}
