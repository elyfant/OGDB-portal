import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { MissionsService } from "./missions.service";

@Controller("missions")
export class MissionsController {
	constructor(private readonly missions: MissionsService) {}

	@Get()
	findAll() {
		return this.missions.findAll();
	}

	@Get("summary")
	getSummary() {
		return this.missions.getSummary();
	}

	@Get("leaderboard")
	getLeaderboard() {
		return this.missions.getLeaderboard();
	}

	// Must come after the static "summary"/"leaderboard" routes above —
	// otherwise :id would swallow those paths first.
	@Get(":id")
	findOne(@Param("id", ParseIntPipe) id: number) {
		return this.missions.findOne(id);
	}
}
