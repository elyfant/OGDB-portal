import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { MissionsController } from "./missions.controller";
import { MissionsService } from "./missions.service";

@Module({
	imports: [DocumentsModule],
	controllers: [MissionsController],
	providers: [MissionsService],
})
export class MissionsModule {}
