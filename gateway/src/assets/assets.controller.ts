import {
	Body,
	Controller,
	Get,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { AssetsService } from "./assets.service";
import { RecordSensorCalibrationDto } from "./dto/record-sensor-calibration.dto";
import { SetAssetStatusDto } from "./dto/set-asset-status.dto";

@Controller("assets")
export class AssetsController {
	constructor(private readonly assets: AssetsService) {}

	@Get()
	findAll() {
		return this.assets.findAll();
	}

	// Must come before :id — otherwise "search" gets swallowed as an id
	// param.
	@Get("search")
	search(@Query("type") type: string, @Query("q") q = "") {
		return this.assets.search(type, q);
	}

	@Get(":id")
	findOne(@Param("id", ParseIntPipe) id: number) {
		return this.assets.findOne(id);
	}

	@Roles("editor", "admin")
	@Patch(":id/status")
	setStatus(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: SetAssetStatusDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.assets.setStatus(id, dto, user.sub);
	}

	@Roles("editor", "admin")
	@Post(":id/calibrations")
	recordCalibration(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: RecordSensorCalibrationDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.assets.recordCalibration(id, dto, user.sub);
	}
}
