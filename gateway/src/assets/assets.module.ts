import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";
import { CertificateParserService } from "./certificate-parser.service";

@Module({
	imports: [DocumentsModule],
	controllers: [AssetsController],
	providers: [AssetsService, CertificateParserService],
})
export class AssetsModule {}
