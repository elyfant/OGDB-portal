import { Controller, Get } from "@nestjs/common";
import { LookupsService } from "./lookups.service";

@Controller("lookups")
export class LookupsController {
	constructor(private readonly lookups: LookupsService) {}

	@Get("projects")
	getProjects() {
		return this.lookups.getProjects();
	}

	@Get("sites")
	getSites() {
		return this.lookups.getSites();
	}

	@Get("institutes")
	getInstitutes() {
		return this.lookups.getInstitutes();
	}

	@Get("contacts")
	getContacts() {
		return this.lookups.getContacts();
	}

	@Get("mission-statuses")
	getMissionStatuses() {
		return this.lookups.getMissionStatuses();
	}
}
