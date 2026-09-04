import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { RmasController } from "./rmas.controller";
import { RmasService } from "./rmas.service";

@Module({
	imports: [DocumentsModule],
	controllers: [RmasController],
	providers: [RmasService],
	// AssetsModule injects RmasService for GET /assets/:id/rmas -- the
	// asset-scoped counterpart to getForAsset above, same pattern as
	// MissionsModule/CalibrationsModule/ServicingModule.
	exports: [RmasService],
})
export class RmasModule {}
