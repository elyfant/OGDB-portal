import { Module } from "@nestjs/common";
import { GlidersController } from "./gliders.controller";
import { GlidersService } from "./gliders.service";

@Module({
	controllers: [GlidersController],
	providers: [GlidersService],
})
export class GlidersModule {}
