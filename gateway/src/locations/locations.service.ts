import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { Location } from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import type { CreateLocationDto } from "./dto/create-location.dto";
import type { RecordAssetLocationDto } from "./dto/record-asset-location.dto";
import type { UpdateLocationDto } from "./dto/update-location.dto";

// `assetCount` = how many assets currently read this place as their
// (valid, recorded) location -- from current_asset_location, so a stale
// pre-recovery row doesn't count. The Locations page shows it so you can
// see what you're deactivating.
const SELECT_LOCATIONS = `
  SELECT l.id, l.name, l.active, COALESCE(c.n, 0)::int AS "assetCount"
  FROM locations l
  LEFT JOIN (
    SELECT location_id, count(*) AS n
    FROM current_asset_location
    WHERE location_source = 'recorded'
    GROUP BY location_id
  ) c ON c.location_id = l.id
`;

// A glider in one of these states has its location fixed by the state, so
// there is nothing to record (see current_asset_location).
const FIXED_LOCATION_MESSAGE: Record<string, string> = {
	deployed: "This glider is deployed, so it is at sea. Recover it first.",
	missing: "This glider is missing, so its location is unknown.",
	destroyed: "This glider is destroyed, so it has no location.",
};

@Injectable()
export class LocationsService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	// Active places only by default (what a pick list wants); the Locations
	// page asks for everything.
	async findAll(includeInactive = false): Promise<Location[]> {
		const result = await this.pool.query(
			`${SELECT_LOCATIONS} ${includeInactive ? "" : "WHERE l.active"}
       ORDER BY l.active DESC, lower(l.name)`,
		);
		return result.rows;
	}

	async findOne(id: number): Promise<Location> {
		const result = await this.pool.query(
			`${SELECT_LOCATIONS} WHERE l.id = $1`,
			[id],
		);
		if (result.rows.length === 0) {
			throw new NotFoundException(`Location ${id} not found`);
		}
		return result.rows[0];
	}

	async create(dto: CreateLocationDto, userId: number): Promise<Location> {
		const name = this.cleanName(dto.name);
		await this.assertNameFree(name);
		try {
			const result = await this.pool.query(
				"INSERT INTO locations (name, changed_by) VALUES ($1, $2) RETURNING id",
				[name, userId],
			);
			return this.findOne(result.rows[0].id);
		} catch (err) {
			throw this.mapUniqueViolation(err, name);
		}
	}

	async update(
		id: number,
		dto: UpdateLocationDto,
		userId: number,
	): Promise<Location> {
		await this.findOne(id);
		if (dto.name === undefined && dto.active === undefined) {
			throw new BadRequestException("Nothing to change.");
		}
		const name = dto.name === undefined ? null : this.cleanName(dto.name);
		if (name) await this.assertNameFree(name, id);
		try {
			await this.pool.query(
				`UPDATE locations
           SET name = COALESCE($2, name),
               active = COALESCE($3, active),
               updated_at = now(), changed_by = $4
         WHERE id = $1`,
				[id, name, dto.active ?? null, userId],
			);
		} catch (err) {
			throw this.mapUniqueViolation(err, name ?? "");
		}
		return this.findOne(id);
	}

	// Appends to asset_location_history. Optional by design -- nothing
	// forces anyone to call this -- but when they do, it refuses the cases
	// that would silently not count:
	//   * the state fixes the location (deployed / missing / destroyed);
	//   * the place is deactivated;
	//   * the date is in the future, or earlier than the asset's last
	//     recovery (current_asset_location would ignore it as stale).
	async recordForAsset(
		assetId: number,
		dto: RecordAssetLocationDto,
		userId: number,
	): Promise<{ id: number }> {
		const asset = await this.pool.query("SELECT 1 FROM assets WHERE id = $1", [
			assetId,
		]);
		if (asset.rows.length === 0) {
			throw new NotFoundException(`Asset ${assetId} not found`);
		}

		const place = await this.pool.query(
			"SELECT active FROM locations WHERE id = $1",
			[dto.locationId],
		);
		if (place.rows.length === 0) {
			throw new BadRequestException(
				`Location ${dto.locationId} doesn't exist.`,
			);
		}
		if (!place.rows[0].active) {
			throw new BadRequestException(
				"That location is deactivated. Pick another, or reactivate it on the Locations page.",
			);
		}

		// Only gliders have a derived state; for any other asset this is empty.
		const state = await this.pool.query(
			"SELECT status FROM derived_asset_status WHERE asset_id = $1",
			[assetId],
		);
		const fixed = FIXED_LOCATION_MESSAGE[state.rows[0]?.status];
		if (fixed) throw new BadRequestException(fixed);

		const check = await this.pool.query(
			`SELECT COALESCE($1::date, CURRENT_DATE) AS d,
              COALESCE($1::date, CURRENT_DATE) > CURRENT_DATE AS future,
              (SELECT max(m.retrieval_date)::date
                 FROM missions m
                 LEFT JOIN status ms ON ms.id = m.status_id
                WHERE m.glider_asset_id = $2
                  AND m.retrieval_date IS NOT NULL
                  AND COALESCE(ms.name, '') NOT IN ('workshop', 'scheduled')
              ) AS "lastRetrieval"`,
			[dto.effectiveDate ?? null, assetId],
		);
		const { d, future, lastRetrieval } = check.rows[0];
		if (future) {
			throw new BadRequestException("The date can't be in the future.");
		}
		if (lastRetrieval && d < lastRetrieval) {
			throw new BadRequestException(
				`That date is before this asset's last recovery (${lastRetrieval}), so it wouldn't count. Use ${lastRetrieval} or later.`,
			);
		}

		const inserted = await this.pool.query(
			`INSERT INTO asset_location_history (asset_id, location_id, effective_date, note, changed_by)
       VALUES ($1, $2, $3::date, $4, $5)
       RETURNING id`,
			[assetId, dto.locationId, d, dto.note?.trim() || null, userId],
		);
		return { id: inserted.rows[0].id };
	}

	private cleanName(raw: string): string {
		const name = raw.trim();
		if (!name) throw new BadRequestException("Give the place a name.");
		return name;
	}

	// The column is UNIQUE, but only case-sensitively; "bergen lab" next to
	// "Bergen lab" is the same place to a person.
	private async assertNameFree(name: string, exceptId?: number) {
		const clash = await this.pool.query(
			"SELECT name FROM locations WHERE lower(name) = lower($1) AND id <> $2",
			[name, exceptId ?? -1],
		);
		if (clash.rows.length > 0) {
			throw new ConflictException(
				`There is already a place called "${clash.rows[0].name}".`,
			);
		}
	}

	private mapUniqueViolation(err: unknown, name: string): Error {
		if (
			err &&
			typeof err === "object" &&
			"code" in err &&
			(err as { code: string }).code === "23505"
		) {
			return new ConflictException(
				`There is already a place called "${name}".`,
			);
		}
		return err instanceof Error ? err : new Error(String(err));
	}
}
