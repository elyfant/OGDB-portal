import { Module } from "@nestjs/common";
import { IridiumController } from "./iridium.controller";
import { IridiumService } from "./iridium.service";

@Module({
	controllers: [IridiumController],
	providers: [IridiumService],
})
export class IridiumModule {}
