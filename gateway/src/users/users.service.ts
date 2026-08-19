import { Inject, Injectable } from "@nestjs/common";
import type { OgdbUser } from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";

@Injectable()
export class UsersService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	// "Who"/"QC who" dropdowns select a person, but the DB stores who_id as
	// an FK to contacts (not users) -- so this returns each real OGDB
	// user's contact_id as the value to submit, scoped to users that
	// actually have a linked contact (excludes service/test accounts with
	// no contact_id, same distinction already visible in the users table).
	async findAll(): Promise<OgdbUser[]> {
		const result = await this.pool.query(
			`SELECT u.id, c.id AS "contactId", TRIM(c.first_name || ' ' || c.last_name) AS name
       FROM users u
       JOIN contacts c ON c.id = u.contact_id
       ORDER BY name`,
		);
		return result.rows;
	}
}
