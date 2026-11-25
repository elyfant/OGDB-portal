import {
	Body,
	Controller,
	Get,
	HttpCode,
	Param,
	ParseIntPipe,
	Post,
	Put,
} from "@nestjs/common";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { SaveValuesDto } from "./dto/save-values.dto";
import { RefurbWrites } from "./refurb-writes";
import { SensorsService } from "./sensors.service";

@RefurbWrites("sensors")
@Controller("missions/:missionId/refurbishment/sensors")
export class SensorsController {
	constructor(private readonly sensors: SensorsService) {}

	@Get()
	get(@Param("missionId", ParseIntPipe) missionId: number) {
		return this.sensors.get(missionId);
	}

	// Put a sensor in: replace one, or add when the slot was empty. Also changes
	// the mission's build.
	@Roles("editor", "admin")
	@Post("swap")
	@HttpCode(200)
	swap(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Body() dto: SaveValuesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.sensors.swap(missionId, dto.values, user.sub);
	}

	@Roles("editor", "admin")
	@Put("checks")
	saveChecks(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Body() dto: SaveValuesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.sensors.saveChecks(missionId, dto.values, user.sub);
	}
}
