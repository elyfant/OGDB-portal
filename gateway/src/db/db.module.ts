import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import { PG_POOL } from "./db.constants";

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
