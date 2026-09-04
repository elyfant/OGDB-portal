import { Module } from "@nestjs/common";
import { CalibrationsModule } from "../calibrations/calibrations.module";
import { DocumentsModule } from "../documents/documents.module";
import { MissionsModule } from "../missions/missions.module";
import { RmasModule } from "../rmas/rmas.module";
import { ServicingModule } from "../servicing/servicing.module";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";
import { CertificateParserService } from "./certificate-parser.service";

@Module({
	imports: [
		DocumentsModule,
		CalibrationsModule,
		ServicingModule,
		MissionsModule,
		RmasModule,
	],
	controllers: [AssetsController],
	providers: [AssetsService, CertificateParserService],
})
export class AssetsModule {}
