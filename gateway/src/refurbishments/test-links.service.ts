import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	RefurbTestGroup,
	RefurbTestKind,
	RefurbTestLinks,
} from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";

const KINDS: readonly RefurbTestKind[] = ["selftest", "field_test"];
const MAX_URL = 500;
const MAX_LABEL = 100;

const personName = (alias: string) =>
	`NULLIF(TRIM(${alias}.first_name || ' ' || ${alias}.last_name), '')`;

// Selftests and field tests already have their own software, so the logsheet
// does not re-implement them. It records that the test was done (and by whom)
// and keeps links to the results there. A glider usually goes through several
// selftests, so the links are a list.
@Injectable()
export class TestLinksService {
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

	async get(missionId: number): Promise<RefurbTestLinks> {
		const id = await this.refurbishmentId(missionId);
		const [links, confirmations] = await Promise.all([
			this.pool.query(
				`SELECT l.id, l.kind, l.url, l.label, l.added_at AS "addedAt",
                ${personName("ac")} AS "addedByName"
           FROM refurb_test_links l
           LEFT JOIN users au ON au.id = l.added_by
           LEFT JOIN contacts ac ON ac.id = au.contact_id
          WHERE l.refurbishment_id = $1
          ORDER BY l.added_at, l.id`,
				[id],
			),
			this.pool.query(
				`SELECT k.kind, k.confirmed_at AS "confirmedAt",
                ${personName("cc")} AS "confirmedByName"
           FROM refurb_test_confirmations k
           LEFT JOIN users cu ON cu.id = k.confirmed_by
           LEFT JOIN contacts cc ON cc.id = cu.contact_id
          WHERE k.refurbishment_id = $1`,
				[id],
			),
		]);
		const group = (kind: RefurbTestKind): RefurbTestGroup => {
			const c = confirmations.rows.find((r) => r.kind === kind);
			return {
				confirmed: Boolean(c),
				confirmedAt: c?.confirmedAt ?? null,
				confirmedByName: c?.confirmedByName ?? null,
				links: links.rows.filter((l) => l.kind === kind),
			};
		};
		return { selftest: group("selftest"), fieldTest: group("field_test") };
	}

	async addLink(
		missionId: number,
		kind: RefurbTestKind,
		input: Record<string, unknown>,
		userId: number,
	): Promise<RefurbTestLinks> {
		const id = await this.refurbishmentId(missionId);
		for (const k of Object.keys(input)) {
			if (k !== "url" && k !== "label") {
				throw new BadRequestException(`Unknown field "${k}".`);
			}
		}
		const url = typeof input.url === "string" ? input.url.trim() : "";
		if (!url) throw new BadRequestException("Enter the address of the test.");
		if (url.length > MAX_URL) {
			throw new BadRequestException(
				`The address is over ${MAX_URL} characters.`,
			);
		}
		// Only web addresses: the portal shows this as a link, so something like
		// javascript: must never get in (the database refuses it as well).
		let parsed: URL;
		try {
			parsed = new URL(url);
		} catch {
			throw new BadRequestException(
				"That is not a web address. Include http:// or https://.",
			);
		}
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			throw new BadRequestException(
				"Only http:// and https:// addresses can be linked.",
			);
		}
		if (/\s/.test(url)) {
			throw new BadRequestException("The address can't contain spaces.");
		}
		const label =
			typeof input.label === "string" && input.label.trim() !== ""
				? input.label.trim()
				: null;
		if (label !== null && label.length > MAX_LABEL) {
			throw new BadRequestException(
				`The name is over ${MAX_LABEL} characters.`,
			);
		}

		try {
			await this.pool.query(
				`INSERT INTO refurb_test_links (refurbishment_id, kind, url, label, added_by)
         VALUES ($1, $2, $3, $4, $5)`,
				[id, kind, url, label, userId],
			);
		} catch (err) {
			if ((err as { code?: string }).code === "23505") {
				throw new ConflictException("That address is already linked.");
			}
			throw err;
		}
		return this.get(missionId);
	}

	async removeLink(
		missionId: number,
		linkId: number,
	): Promise<RefurbTestLinks> {
		const id = await this.refurbishmentId(missionId);
		const res = await this.pool.query(
			"DELETE FROM refurb_test_links WHERE id = $1 AND refurbishment_id = $2",
			[linkId, id],
		);
		if (res.rowCount === 0) {
			throw new NotFoundException(`Link ${linkId} not found.`);
		}
		return this.get(missionId);
	}

	// Confirms (or un-confirms) that the test has been done. Confirming twice
	// keeps the first person's name and time.
	async setConfirmed(
		missionId: number,
		kind: RefurbTestKind,
		confirmed: boolean,
		userId: number,
	): Promise<RefurbTestLinks> {
		const id = await this.refurbishmentId(missionId);
		if (confirmed) {
			await this.pool.query(
				`INSERT INTO refurb_test_confirmations (refurbishment_id, kind, confirmed_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (refurbishment_id, kind) DO NOTHING`,
				[id, kind, userId],
			);
		} else {
			await this.pool.query(
				"DELETE FROM refurb_test_confirmations WHERE refurbishment_id = $1 AND kind = $2",
				[id, kind],
			);
		}
		return this.get(missionId);
	}

	// Why the Selftest is not complete yet (empty when it is). A field test is
	// optional and never blocks clearing.
	async blockers(missionId: number): Promise<string[]> {
		const { selftest } = await this.get(missionId);
		const out: string[] = [];
		if (selftest.links.length === 0) out.push("no selftest linked");
		if (!selftest.confirmed) out.push("not confirmed as done");
		return out.length > 0 ? [`Selftest: ${out.join(", ")}.`] : [];
	}
}

export function parseKind(raw: string): RefurbTestKind {
	// The URL uses a dash (field-test); the database a underscore (field_test).
	const kind = raw.replace("-", "_") as RefurbTestKind;
	if (!KINDS.includes(kind)) {
		throw new BadRequestException(`Unknown kind "${raw}".`);
	}
	return kind;
}
