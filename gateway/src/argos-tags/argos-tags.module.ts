import { Module } from "@nestjs/common";
import { ArgosTagsController } from "./argos-tags.controller";
import { ArgosTagsService } from "./argos-tags.service";

@Module({
	controllers: [ArgosTagsController],
	providers: [ArgosTagsService],
	exports: [ArgosTagsService],
})
export class ArgosTagsModule {}
