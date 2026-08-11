import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseIntPipe,
	Patch,
	Post,
} from "@nestjs/common";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { CreateGliderDto } from "./dto/create-glider.dto";
import { SetGliderStatusDto } from "./dto/set-glider-status.dto";
import { UpdateGliderDto } from "./dto/update-glider.dto";
import { GlidersService } from "./gliders.service";

@Controller("gliders")
export class GlidersController {
	constructor(private readonly gliders: GlidersService) {}

	@Get()
	findAll() {
		return this.gliders.findAll();
	}

	@Get(":id")
	findOne(@Param("id", ParseIntPipe) id: number) {
		return this.gliders.findOne(id);
	}

	@Roles("editor", "admin")
	@Post()
	create(@Body() dto: CreateGliderDto, @CurrentUser() user: JwtPayload) {
		return this.gliders.create(dto, user.sub);
	}

	@Roles("editor", "admin")
	@Patch(":id")
	update(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: UpdateGliderDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.gliders.update(id, dto, user.sub);
	}

	@Roles("editor", "admin")
	@Patch(":id/status")
	setStatus(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: SetGliderStatusDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.gliders.setStatus(id, dto, user.sub);
	}

	@Roles("editor", "admin")
	@Delete(":id")
	@HttpCode(204)
	remove(@Param("id", ParseIntPipe) id: number) {
		return this.gliders.remove(id);
	}
}
