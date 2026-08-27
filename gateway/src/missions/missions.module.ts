import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { MissionsController } from "./missions.controller";
import { MissionsService } from "./missions.service";

@Module({
	imports: [DocumentsModule],
	controllers: [MissionsController],
	providers: [MissionsService],
	// AssetsModule injects MissionsService for GET /assets/:id/missions --
	// the asset-scoped counterpart to getSciencePayload/
	// getStructuralComponents above, just walking the relationship the
	// other direction (asset -> missions instead of mission -> assets).
	exports: [MissionsService],
})
export class MissionsModule {}
