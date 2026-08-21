import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";

@Module({
	imports: [DocumentsModule],
	controllers: [AssetsController],
	providers: [AssetsService],
})
export class AssetsModule {}
