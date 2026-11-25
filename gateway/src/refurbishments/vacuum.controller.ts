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
import { RefurbWrites } from "./refurb-writes";
import { VacuumService } from "./vacuum.service";

@RefurbWrites("vacuum")
@Controller("missions/:missionId/refurbishment/vacuum")
export class VacuumController {
	constructor(private readonly vacuum: VacuumService) {}

	@Get()
	get(@Param("missionId", ParseIntPipe) missionId: number) {
		return this.vacuum.get(missionId);
	}

	@Roles("editor", "admin")
	@Put()
	save(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Body() dto: SaveValuesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.vacuum.save(missionId, dto.values, user.sub);
	}
}
