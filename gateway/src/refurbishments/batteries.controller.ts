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
import { BatteriesService } from "./batteries.service";
import { SaveValuesDto } from "./dto/save-values.dto";
import { RefurbWrites } from "./refurb-writes";

@RefurbWrites("batteries")
@Controller("missions/:missionId/refurbishment/batteries")
export class BatteriesController {
	constructor(private readonly batteries: BatteriesService) {}

	@Get()
	get(@Param("missionId", ParseIntPipe) missionId: number) {
		return this.batteries.get(missionId);
	}

	// Registered before the :position route so "checks" is not read as a slot.
	@Roles("editor", "admin")
	@Put("checks")
	saveChecks(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Body() dto: SaveValuesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.batteries.saveChecks(missionId, dto.values, user.sub);
	}

	@Roles("editor", "admin")
	@Put("packs/:position")
	savePack(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Param("position") position: string,
		@Body() dto: SaveValuesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.batteries.savePack(missionId, position, dto.values, user.sub);
	}
}
