import { Inject, Injectable } from "@nestjs/common";
import type { AssetStatusOption } from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";

@Injectable()
export class AssetStatusOptionsService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	async findAll(): Promise<AssetStatusOption[]> {
		const result = await this.pool.query(
			"SELECT id, name, description FROM asset_status_options ORDER BY id",
		);
		return result.rows;
	}
}
