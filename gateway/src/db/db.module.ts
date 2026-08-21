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
