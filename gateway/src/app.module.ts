import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ArgosTagsModule } from "./argos-tags/argos-tags.module";
import { AssetStatusOptionsModule } from "./asset-status-options/asset-status-options.module";
import { AssetsModule } from "./assets/assets.module";
import { AuthModule } from "./auth/auth.module";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";
import { RolesGuard } from "./auth/roles.guard";
import { BundlesModule } from "./bundles/bundles.module";
import { CalibrationsModule } from "./calibrations/calibrations.module";
import { CruisesModule } from "./cruises/cruises.module";
import { DatasetsModule } from "./datasets/datasets.module";
import { DbModule } from "./db/db.module";
import { DocumentsModule } from "./documents/documents.module";
import { GlidersModule } from "./gliders/gliders.module";
import { IridiumModule } from "./iridium/iridium.module";
import { LocationsModule } from "./locations/locations.module";
import { LookupsModule } from "./lookups/lookups.module";
import { MissionsModule } from "./missions/missions.module";
import { ProcessingPackagesModule } from "./processing-packages/processing-packages.module";
import { RefurbishmentsModule } from "./refurbishments/refurbishments.module";
import { RmasModule } from "./rmas/rmas.module";
import { UsersModule } from "./users/users.module";

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true }),
		DbModule,
		AuthModule,
		GlidersModule,
		ArgosTagsModule,
		AssetsModule,
		AssetStatusOptionsModule,
		CalibrationsModule,
		DocumentsModule,
		LocationsModule,
		LookupsModule,
		MissionsModule,
		RefurbishmentsModule,
		DatasetsModule,
		BundlesModule,
		CruisesModule,
		UsersModule,
		ProcessingPackagesModule,
		RmasModule,
		IridiumModule,
	],
	providers: [
		{ provide: APP_GUARD, useClass: JwtAuthGuard },
		{ provide: APP_GUARD, useClass: RolesGuard },
	],
})
export class AppModule {}
