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
import { SoftwareService } from "./software.service";

@Controller("missions/:missionId/refurbishment/software")
export class SoftwareController {
	constructor(private readonly software: SoftwareService) {}

	@Get()
	get(@Param("missionId", ParseIntPipe) missionId: number) {
		return this.software.get(missionId);
	}

	@Roles("editor", "admin")
	@Put()
	save(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Body() dto: SaveValuesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.software.save(missionId, dto.values, user.sub);
	}
}
