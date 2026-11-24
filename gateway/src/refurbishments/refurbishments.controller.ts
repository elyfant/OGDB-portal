import {
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
}
