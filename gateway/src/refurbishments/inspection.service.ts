import {
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { RefurbInspection, RefurbInspectionItem } from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import { MAX_TEXT } from "./field-coerce";

type Def = Pick<
	RefurbInspectionItem,
	"key" | "phase" | "kind" | "label" | "hint"
>;

// The logsheet's inspection checklist, in the order it is done. The keys are
// also in the table's CHECK constraint; change both together (a migration).
const ITEMS: readonly Def[] = [
	{
		key: "wings",
		phase: "external",
		kind: "check",
		label: "Wings",
		hint: null,
	},
	{
		key: "rudder",
		phase: "external",
		kind: "check",
		label: "Rudder",
		hint: null,
	},
	{
		key: "outer_fairing",
		phase: "external",
		kind: "check",
		label: "Outer fairing",
		hint: null,
	},
	{
		key: "antenna",
		phase: "external",
		kind: "check",
		label: "Antenna",
		hint: null,
	},
	{
		key: "external_sensors",
		phase: "external",
		kind: "check",
		label: "Sensors (external)",
		hint: null,
	},
	{
		key: "vacuum_released",
		phase: "internal",
		kind: "step",
		label: "Vacuum released",
		hint: null,
	},
	{
		key: "pitch_battery_aft",
		phase: "internal",
		kind: "step",
		label: "Pitch battery set all the way aft before opening",
		hint: "Then remove the forward fairing, place it on the rig and remove the top hatch.",
	},
	{
		key: "fwd_hull_corrosion",
		phase: "internal",
		kind: "check",
		label: "Forward hull: corrosion",
		hint: "Visual check. Note any loss of anodising or pitting, and mark the area for monitoring.",
	},
	{
		key: "fwd_hull_continuity",
		phase: "internal",
		kind: "check",
		label: "Forward hull: continuity",
		hint: "Multimeter in continuity mode across the hull.",
	},
	{
		key: "aft_hull_corrosion",
		phase: "internal",
		kind: "check",
		label: "Aft hull: corrosion",
		hint: "Remove the aft fairing first.",
	},
	{
		key: "aft_hull_continuity",
		phase: "internal",
		kind: "check",
		label: "Aft hull: continuity",
		hint: null,
	},
	{
		key: "anode",
		phase: "internal",
		kind: "check",
		label: "Anode: continuity",
		hint: "Test continuity of the anode. Mark Repaired if it was replaced.",
	},
	{
		key: "bulkhead_connectors",
		phase: "internal",
		kind: "check",
		label: "Bulkhead connectors, cables and dummy connectors",
		hint: null,
	},
	{
		key: "vbd_bladder",
		phase: "internal",
		kind: "check",
		label: "VBD bladder: wear",
		hint: null,
	},
];

const CHECK_STATUSES = ["ok", "issue", "repaired"];
const STEP_STATUSES = ["done"];

const personName = (alias: string) =>
	`NULLIF(TRIM(${alias}.first_name || ' ' || ${alias}.last_name), '')`;

@Injectable()
export class InspectionService {
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

	async get(missionId: number): Promise<RefurbInspection> {
		const id = await this.refurbishmentId(missionId);
		const rows = await this.pool.query(
			`SELECT i.item, i.status, i.note, i.updated_at AS "updatedAt",
              ${personName("uc")} AS "updatedByName"
         FROM refurb_inspection_items i
         LEFT JOIN users uu ON uu.id = i.updated_by
         LEFT JOIN contacts uc ON uc.id = uu.contact_id
        WHERE i.refurbishment_id = $1`,
			[id],
		);
		const byItem = new Map(rows.rows.map((r) => [r.item, r]));
		return {
			items: ITEMS.map((d) => {
				const r = byItem.get(d.key);
				return {
					...d,
					status: r?.status ?? null,
					note: r?.note ?? null,
					updatedAt: r?.updatedAt ?? null,
					updatedByName: r?.updatedByName ?? null,
				};
			}),
		};
	}

	// Saves a batch of checklist results in one transaction. An issue or a
	// repair must say what and where.
	async save(
		missionId: number,
		input: Record<string, unknown>,
		userId: number,
	): Promise<RefurbInspection> {
		const id = await this.refurbishmentId(missionId);
		for (const k of Object.keys(input)) {
			if (k !== "items") throw new BadRequestException(`Unknown field "${k}".`);
		}
		const items = input.items;
		if (!Array.isArray(items) || items.length > ITEMS.length) {
			throw new BadRequestException("items: expected a list of results.");
		}
		const defs = new Map(ITEMS.map((d) => [d.key, d]));
		const seen = new Set<string>();
		const parsed = items.map((t) => {
			const key = typeof t?.key === "string" ? t.key : "";
			const def = defs.get(key);
			if (!def) {
				throw new BadRequestException(`"${key}" is not an inspection item.`);
			}
			if (seen.has(key)) {
				throw new BadRequestException(`"${key}" is listed twice.`);
			}
			seen.add(key);
			const status = t.status ?? null;
			const allowed = def.kind === "step" ? STEP_STATUSES : CHECK_STATUSES;
			if (status !== null && !allowed.includes(status)) {
				throw new BadRequestException(
					`${def.label}: status must be ${allowed.join(", ")}.`,
				);
			}
			const note =
				typeof t.note === "string" && t.note.trim() !== ""
					? t.note.trim()
					: null;
			if (note !== null && note.length > MAX_TEXT) {
				throw new BadRequestException(`${def.label}: note is too long.`);
			}
			if ((status === "issue" || status === "repaired") && note === null) {
				throw new BadRequestException(
					`${def.label}: say what and where before saving "${status === "issue" ? "needs work" : "repaired"}".`,
				);
			}
			return { key, status, note };
		});

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			for (const t of parsed) {
				await client.query(
					`INSERT INTO refurb_inspection_items (refurbishment_id, item, status, note, updated_by)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (refurbishment_id, item) DO UPDATE SET
             status = EXCLUDED.status, note = EXCLUDED.note,
             updated_by = EXCLUDED.updated_by, updated_at = now()`,
					[id, t.key, t.status, t.note, userId],
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

	// Why Inspections is not complete yet (empty when it is): every item
	// looked at, and nothing still needing work.
	async blockers(missionId: number): Promise<string[]> {
		const { items } = await this.get(missionId);
		const out: string[] = [];
		const open = items.filter((i) => i.status === "issue").map((i) => i.label);
		if (open.length > 0) {
			out.push(`Inspections: still needs work: ${open.join(", ")}.`);
		}
		const todo = items.filter((i) => i.status === null);
		if (todo.length > 0) {
			out.push(`Inspections: ${todo.length} of ${items.length} not done.`);
		}
		return out;
	}
}
