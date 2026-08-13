import {
	Body,
	Controller,
	Get,
	Param,
	ParseIntPipe,
	Patch,
} from "@nestjs/common";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { AssetsService } from "./assets.service";
import { SetAssetStatusDto } from "./dto/set-asset-status.dto";

@Controller("assets")
export class AssetsController {
	constructor(private readonly assets: AssetsService) {}

	@Get()
	findAll() {
		return this.assets.findAll();
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
}
