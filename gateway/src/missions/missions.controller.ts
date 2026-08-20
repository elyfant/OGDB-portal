import {
	Body,
	Controller,
	Get,
	Param,
	ParseIntPipe,
	Patch,
	Post,
} from "@nestjs/common";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { CreateMissionDto } from "./dto/create-mission.dto";
import { UpdateMissionFolderPathDto } from "./dto/update-mission-folder-path.dto";
import { UpdateMissionDto } from "./dto/update-mission.dto";
import { MissionsService } from "./missions.service";

@Controller("missions")
export class MissionsController {
	constructor(private readonly missions: MissionsService) {}

	@Get()
	findAll() {
		return this.missions.findAll();
	}

	@Roles("editor", "admin")
	@Post()
	createMission(
		@Body() dto: CreateMissionDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.missions.createMission(dto, user.sub);
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

	@Get(":id/science-payload")
	getSciencePayload(@Param("id", ParseIntPipe) id: number) {
		return this.missions.getSciencePayload(id);
	}

	@Roles("editor", "admin")
	@Patch(":id")
	updateMission(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: UpdateMissionDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.missions.updateMission(id, dto, user.sub);
	}

	@Roles("editor", "admin")
	@Patch(":id/folder-path")
	updateFolderPath(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: UpdateMissionFolderPathDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.missions.updateFolderPath(id, dto, user.sub);
	}
}
