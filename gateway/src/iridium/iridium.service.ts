import { Inject, Injectable } from "@nestjs/common";
import type {
	IridiumGliderMonth,
	IridiumMissionCost,
	IridiumMissionDetail,
	IridiumMissionMonth,
	IridiumMonthlyCost,
	IridiumSummary,
} from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";

// Read-only. Every number here is computed by norgliders-utils/iridium-costs
// and stored by its monthly `push`; OGDB's iridium_* views (migration
// xxxx_iridium_costs) do the joins and the NOK conversion. This service
// only selects and renames, so the allocation rules live in one place.
//
// numeric -> ::float8 so pg returns JS numbers, not strings. Fine for
// display; the exact values stay in the DB. Months go out as "YYYY-MM"
// text so no timezone can shift them.

const SELECT_MISSION_COST = `
  SELECT
    mission_id AS "missionId",
    mission_number AS "missionNumber",
    std_mission_name AS "stdMissionName",
    status,
    glider_asset_id AS "gliderAssetId",
    glider_name AS "gliderName",
    platform,
    launch_date AS "launchDate",
    recovery_date AS "recoveryDate",
    duration_days::float8 AS "durationDays",
    mission_months::int AS "missionMonths",
    invoiced_months::int AS "invoicedMonths",
    fully_invoiced AS "fullyInvoiced",
    mission_usage_usd::float8 AS "missionUsageUsd",
    mission_rental_usd::float8 AS "missionRentalUsd",
    after_recovery_usd::float8 AS "afterRecoveryUsd",
    before_launch_usd::float8 AS "beforeLaunchUsd",
    total_usd::float8 AS "totalUsd",
    total_nok::float8 AS "totalNok",
    usd_per_day::float8 AS "usdPerDay",
    left_on_months AS "leftOnMonths",
    pre_launch_months AS "preLaunchMonths"
  FROM iridium_mission_costs
`;

@Injectable()
export class IridiumService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	async getSummary(): Promise<IridiumSummary> {
		const [run, nok, rate] = await Promise.all([
			this.pool.query(`
        SELECT
          run_at AS "runAt",
          tool_version AS "toolVersion",
          invoices_read AS "invoicesRead",
          to_char(first_month, 'YYYY-MM') AS "firstMonth",
          to_char(last_month, 'YYYY-MM') AS "lastMonth",
          total_usd::float8 AS "totalUsd",
          warnings
        FROM iridium_latest_run
      `),
			// NULL (not a low number) if any month lacks a rate.
			this.pool.query(`
        SELECT CASE WHEN count(*) = count(nok) THEN sum(nok) END::float8 AS "totalNok"
        FROM iridium_allocation_detail
      `),
			this.pool.query(`
        SELECT to_char(month, 'YYYY-MM') AS month, usd_nok::float8 AS "usdNok"
        FROM usd_nok_rates
        ORDER BY month DESC
        LIMIT 1
      `),
		]);
		return {
			lastRun: run.rows[0] ?? null,
			totalNok: nok.rows[0]?.totalNok ?? null,
			latestRate: rate.rows[0] ?? null,
		};
	}

	async getMissions(): Promise<IridiumMissionCost[]> {
		const result = await this.pool.query(
			`${SELECT_MISSION_COST} ORDER BY launch_date DESC`,
		);
		return result.rows;
	}

	async getMission(missionId: number): Promise<IridiumMissionDetail> {
		const [cost, months] = await Promise.all([
			this.pool.query(`${SELECT_MISSION_COST} WHERE mission_id = $1`, [
				missionId,
			]),
			this.pool.query<IridiumMissionMonth>(
				`
        SELECT
          to_char(month, 'YYYY-MM') AS month,
          COALESCE(sum(usd) FILTER (WHERE category = 'mission_usage'), 0)::float8 AS "missionUsageUsd",
          COALESCE(sum(usd) FILTER (WHERE category = 'mission_rental'), 0)::float8 AS "missionRentalUsd",
          COALESCE(sum(usd) FILTER (WHERE category = 'before_launch'), 0)::float8 AS "beforeLaunchUsd",
          COALESCE(sum(usd) FILTER (WHERE category = 'after_recovery'), 0)::float8 AS "afterRecoveryUsd"
        FROM iridium_allocation_detail
        WHERE mission_id = $1
        GROUP BY month
        ORDER BY month
        `,
				[missionId],
			),
		]);
		return { cost: cost.rows[0] ?? null, months: months.rows };
	}

	// Per month x platform x category, summed over both Metocean accounts.
	async getMonthly(): Promise<IridiumMonthlyCost[]> {
		const result = await this.pool.query(`
      SELECT
        to_char(month, 'YYYY-MM') AS month,
        platform,
        category,
        sum(usd)::float8 AS usd,
        CASE WHEN bool_and(nok IS NOT NULL) THEN sum(nok) END::float8 AS nok
      FROM iridium_monthly_costs
      GROUP BY month, platform, category
      ORDER BY month, platform, category
    `);
		return result.rows;
	}

	// Each known glider's cost over the last 12 invoiced months (counted
	// back from the newest invoice, not from today, so a late push still
	// shows a full year). A month with no invoice line has no row.
	async getGliderMonths(): Promise<IridiumGliderMonth[]> {
		const result = await this.pool.query(`
      SELECT
        d.glider_asset_id AS "gliderAssetId",
        d.glider_name AS "gliderName",
        d.platform,
        to_char(d.month, 'YYYY-MM') AS month,
        sum(d.usd)::float8 AS usd,
        COALESCE(sum(d.usd) FILTER (WHERE d.mission_id IS NOT NULL), 0)::float8 AS "missionUsd"
      FROM iridium_allocation_detail d
      WHERE d.glider_asset_id IS NOT NULL
        AND d.month > (SELECT max(month) FROM iridium_allocation_detail) - interval '12 months'
      GROUP BY d.glider_asset_id, d.glider_name, d.platform, d.month
      ORDER BY d.glider_name, d.month
    `);
		return result.rows;
	}
}
