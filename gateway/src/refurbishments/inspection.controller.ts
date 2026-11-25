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
import { InspectionService } from "./inspection.service";
import { RefurbWrites } from "./refurb-writes";

@RefurbWrites("inspections")
@Controller("missions/:missionId/refurbishment/inspection")
export class InspectionController {
	constructor(private readonly inspection: InspectionService) {}

	@Get()
	get(@Param("missionId", ParseIntPipe) missionId: number) {
		return this.inspection.get(missionId);
	}

	@Roles("editor", "admin")
	@Put()
	save(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Body() dto: SaveValuesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.inspection.save(missionId, dto.values, user.sub);
	}
}
