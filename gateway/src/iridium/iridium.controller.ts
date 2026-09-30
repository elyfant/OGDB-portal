import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { IridiumService } from "./iridium.service";

// Read-only; any logged-in user (the global JwtAuthGuard), no @Roles.
// Never @Public(): costs are internal budget information.
@Controller("iridium")
export class IridiumController {
	constructor(private readonly iridium: IridiumService) {}

	@Get("summary")
	getSummary() {
		return this.iridium.getSummary();
	}

	@Get("missions")
	getMissions() {
		return this.iridium.getMissions();
	}

	@Get("missions/:id")
	getMission(@Param("id", ParseIntPipe) id: number) {
		return this.iridium.getMission(id);
	}

	@Get("monthly")
	getMonthly() {
		return this.iridium.getMonthly();
	}

	@Get("gliders/monthly")
	getGliderMonths() {
		return this.iridium.getGliderMonths();
	}
}
