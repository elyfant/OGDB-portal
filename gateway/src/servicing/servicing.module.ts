import { Module } from "@nestjs/common";
import { DocumentsModule } from "../documents/documents.module";
import { ServicingService } from "./servicing.service";

@Module({
	imports: [DocumentsModule],
	providers: [ServicingService],
	exports: [ServicingService],
})
export class ServicingModule {}
