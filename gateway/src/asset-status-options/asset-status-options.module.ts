import { Module } from "@nestjs/common";
import { AssetStatusOptionsController } from "./asset-status-options.controller";
import { AssetStatusOptionsService } from "./asset-status-options.service";

@Module({
	controllers: [AssetStatusOptionsController],
	providers: [AssetStatusOptionsService],
	exports: [AssetStatusOptionsService],
})
export class AssetStatusOptionsModule {}
