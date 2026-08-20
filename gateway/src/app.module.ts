import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AssetStatusOptionsModule } from "./asset-status-options/asset-status-options.module";
import { AssetsModule } from "./assets/assets.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { CalibrationsModule } from "./calibrations/calibrations.module";
import { CruisesModule } from "./cruises/cruises.module";
import { DatasetsModule } from "./datasets/datasets.module";
import { DbModule } from "./db/db.module";
import { GlidersModule } from "./gliders/gliders.module";
import { MissionsModule } from "./missions/missions.module";
import { ProcessingPackagesModule } from "./processing-packages/processing-packages.module";
import { UsersModule } from "./users/users.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		DbModule,
		AuthModule,
		GlidersModule,
		AssetsModule,
		AssetStatusOptionsModule,
		CalibrationsModule,
		MissionsModule,
		DatasetsModule,
		CruisesModule,
		UsersModule,
		ProcessingPackagesModule,
	],
	providers: [
		{ provide: APP_GUARD, useClass: JwtAuthGuard },
		{ provide: APP_GUARD, useClass: RolesGuard },
	],
})
export class AppModule {}
