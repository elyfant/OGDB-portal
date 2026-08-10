import { Controller, Get } from "@nestjs/common";
import { AssetStatusOptionsService } from "./asset-status-options.service";

@Controller("asset-status-options")
export class AssetStatusOptionsController {
	constructor(private readonly statusOptions: AssetStatusOptionsService) {}

	@Get()
	findAll() {
		return this.statusOptions.findAll();
	}
}
