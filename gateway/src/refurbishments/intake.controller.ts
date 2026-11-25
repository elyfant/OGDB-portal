import {
	Body,
	Controller,
	Get,
	Param,
	ParseIntPipe,
	Put,
} from "@nestjs/common";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { SaveValuesDto } from "./dto/save-values.dto";
import { IntakeService } from "./intake.service";
import { RefurbWrites } from "./refurb-writes";

@RefurbWrites("intake")
@Controller("missions/:missionId/refurbishment/intake")
export class IntakeController {
	constructor(private readonly intake: IntakeService) {}

	@Get()
	get(@Param("missionId", ParseIntPipe) missionId: number) {
		return this.intake.get(missionId);
	}

	// Also saves the old tag's configuration and test readings, in the same
	// transaction.
	@Roles("editor", "admin")
	@Put()
	save(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Body() dto: SaveValuesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.intake.save(missionId, dto.values, user.sub);
	}
}
