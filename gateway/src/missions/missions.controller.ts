import { Controller, Get } from "@nestjs/common";
import { MissionsService } from "./missions.service";

@Controller("missions")
export class MissionsController {
	constructor(private readonly missions: MissionsService) {}

	@Get()
	findAll() {
		return this.missions.findAll();
	}
}
