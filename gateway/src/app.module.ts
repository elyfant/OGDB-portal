import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AssetStatusOptionsModule } from "./asset-status-options/asset-status-options.module";
import { DbModule } from "./db/db.module";
import { GlidersModule } from "./gliders/gliders.module";
import { MissionsModule } from "./missions/missions.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		DbModule,
		GlidersModule,
		AssetStatusOptionsModule,
		MissionsModule,
	],
})
export class AppModule {}
