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

	@Get("vessels")
	getVessels() {
		return this.lookups.getVessels();
	}

	@Get("asset-types")
	getAssetTypes() {
		return this.lookups.getAssetTypes();
	}

	@Get("platforms")
	getPlatforms() {
		return this.lookups.getPlatforms();
	}

	@Get("sensor-models")
	getSensorModels() {
		return this.lookups.getSensorModels();
	}

	@Get("battery-models")
	getBatteryModels() {
		return this.lookups.getBatteryModels();
	}

	@Get("manufacturers")
	getManufacturers() {
		return this.lookups.getManufacturers();
	}
}
