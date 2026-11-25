import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseIntPipe,
	Patch,
	Post,
} from "@nestjs/common";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { SaveTankRunDto } from "./dto/save-tank-run.dto";
import { RefurbWrites } from "./refurb-writes";
import { TankRunsService } from "./tank-runs.service";

@RefurbWrites("tank_test")
@Controller("missions/:missionId/refurbishment/tank-runs")
export class TankRunsController {
	constructor(private readonly tankRuns: TankRunsService) {}

	@Get()
	list(@Param("missionId", ParseIntPipe) missionId: number) {
		return this.tankRuns.list(missionId);
	}

	// "Add another run": a new, empty run with the next number.
	@Roles("editor", "admin")
	@Post()
	@HttpCode(201)
	create(
		@Param("missionId", ParseIntPipe) missionId: number,
		@CurrentUser() user: JwtPayload,
	) {
		return this.tankRuns.create(missionId, user.sub);
	}

	@Roles("editor", "admin")
	@Patch(":runId")
	update(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Param("runId", ParseIntPipe) runId: number,
		@Body() dto: SaveTankRunDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.tankRuns.update(missionId, runId, dto.values, user.sub);
	}

	@Roles("editor", "admin")
	@Post(":runId/sign-off")
	@HttpCode(200)
	signOff(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Param("runId", ParseIntPipe) runId: number,
		@CurrentUser() user: JwtPayload,
	) {
		return this.tankRuns.signOff(missionId, runId, user.sub);
	}

	@Roles("editor", "admin")
	@Delete(":runId")
	@HttpCode(204)
	async remove(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Param("runId", ParseIntPipe) runId: number,
	) {
		await this.tankRuns.remove(missionId, runId);
	}
}
