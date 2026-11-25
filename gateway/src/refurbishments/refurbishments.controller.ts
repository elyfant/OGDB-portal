import {
	Body,
	Controller,
	Get,
	HttpCode,
	Param,
	ParseIntPipe,
	Post,
} from "@nestjs/common";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { SaveValuesDto } from "./dto/save-values.dto";
import { RefurbishmentsService } from "./refurbishments.service";

@Controller("missions/:missionId/refurbishment")
export class RefurbishmentsController {
	constructor(private readonly refurbishments: RefurbishmentsService) {}

	// null (empty body) when the mission has no logsheet yet.
	@Get()
	find(@Param("missionId", ParseIntPipe) missionId: number) {
		return this.refurbishments.findByMission(missionId);
	}

	@Roles("editor", "admin")
	@Post()
	@HttpCode(201)
	start(
		@Param("missionId", ParseIntPipe) missionId: number,
		@CurrentUser() user: JwtPayload,
	) {
		return this.refurbishments.start(missionId, user.sub);
	}

	// Clear the glider for deployment: records who, and locks the logsheet. Only
	// when every required section is done.
	@Roles("editor", "admin")
	@Post("clear")
	@HttpCode(200)
	clear(
		@Param("missionId", ParseIntPipe) missionId: number,
		@CurrentUser() user: JwtPayload,
	) {
		return this.refurbishments.clear(missionId, user.sub);
	}

	// Unlock a cleared logsheet. Withdraws the clearance; needs a reason.
	@Roles("editor", "admin")
	@Post("unlock")
	@HttpCode(200)
	unlock(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Body() dto: SaveValuesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.refurbishments.unlock(missionId, dto.values.reason, user.sub);
	}
}
