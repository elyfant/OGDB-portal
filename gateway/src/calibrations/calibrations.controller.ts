import { Controller, Get } from "@nestjs/common";
import { CalibrationsService } from "./calibrations.service";

@Controller("calibrations")
export class CalibrationsController {
	constructor(private readonly calibrations: CalibrationsService) {}

	@Get()
	getCatalogue() {
		return this.calibrations.getCatalogue();
	}
}
