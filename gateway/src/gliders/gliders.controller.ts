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
import { CreateGliderDto } from "./dto/create-glider.dto";
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

	@Post()
	create(@Body() dto: CreateGliderDto) {
		return this.gliders.create(dto);
	}

	@Patch(":id")
	update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateGliderDto) {
		return this.gliders.update(id, dto);
	}

	@Delete(":id")
	@HttpCode(204)
	remove(@Param("id", ParseIntPipe) id: number) {
		return this.gliders.remove(id);
	}
}
