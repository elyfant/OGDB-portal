import { Module } from "@nestjs/common";
import { ProcessingPackagesController } from "./processing-packages.controller";
import { ProcessingPackagesService } from "./processing-packages.service";

@Module({
	controllers: [ProcessingPackagesController],
	providers: [ProcessingPackagesService],
	exports: [ProcessingPackagesService],
})
export class ProcessingPackagesModule {}
