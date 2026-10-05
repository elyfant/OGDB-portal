import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Pool, types } from "pg";
import { PG_POOL } from "./db.constants";

// pg's default DATE (oid 1082) parser converts the wire value into a JS
// Date at local midnight -- which then round-trips through
// JSON.stringify's UTC-based toISOString() and comes out shifted by a
// day in any timezone ahead of UTC (confirmed: 2023-04-05 became
// "2023-04-04T22:00:00.000Z" in Europe/Oslo). A plain calendar date has
// no timezone component to begin with, so the fix is to never construct
// a Date from it at all -- return Postgres's raw "YYYY-MM-DD" wire
// string unchanged. This is a process-wide override (pg's type parser
// registry isn't per-Pool), so it fixes every DATE column read through
// any query, not just the ones this session touched.
types.setTypeParser(1082, (value: string) => value);

// Same trap for TIMESTAMP WITHOUT TIME ZONE (oid 1114) -- missions'
// launch_date / end_date_science / recovery_date. pg's default parser
// reads the wire value as *local* time, so in Europe/Oslo midnight
// 2016-11-09 serialises as "2016-11-08T23:00:00.000Z"; the edit form keeps
// the date part, and every save moved the mission's dates back a day
// (seen on mission 25 against ogdb-test). OGDB stores these as UTC
// wall-clock values, so parse them as UTC. Production's container already
// runs in UTC, where this is a no-op -- it makes local dev match prod.
types.setTypeParser(
	1114,
	(value: string) => new Date(`${value.replace(" ", "T")}Z`),
);

@Global()
@Module({
	imports: [ConfigModule],
	providers: [
		{
			provide: PG_POOL,
			inject: [ConfigService],
			useFactory: (config: ConfigService) =>
				new Pool({ connectionString: config.get<string>("DATABASE_URL") }),
		},
	],
	exports: [PG_POOL],
})
export class DbModule {}
