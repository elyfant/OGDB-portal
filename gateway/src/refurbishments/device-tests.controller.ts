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
import { DeviceTestsService } from "./device-tests.service";
import { SaveValuesDto } from "./dto/save-values.dto";
import { RefurbWrites } from "./refurb-writes";

@RefurbWrites("device_tests")
@Controller("missions/:missionId/refurbishment/device-tests")
export class DeviceTestsController {
	constructor(private readonly deviceTests: DeviceTestsService) {}

	@Get()
	get(@Param("missionId", ParseIntPipe) missionId: number) {
		return this.deviceTests.get(missionId);
	}

	@Roles("editor", "admin")
	@Put()
	save(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Body() dto: SaveValuesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.deviceTests.save(missionId, dto.values, user.sub);
	}
}
