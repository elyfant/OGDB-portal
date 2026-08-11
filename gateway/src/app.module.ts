import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AssetStatusOptionsModule } from "./asset-status-options/asset-status-options.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { DbModule } from "./db/db.module";
import { GlidersModule } from "./gliders/gliders.module";
import { MissionsModule } from "./missions/missions.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		DbModule,
		AuthModule,
		GlidersModule,
		AssetStatusOptionsModule,
		MissionsModule,
	],
	providers: [
		{ provide: APP_GUARD, useClass: JwtAuthGuard },
		{ provide: APP_GUARD, useClass: RolesGuard },
	],
})
export class AppModule {}
