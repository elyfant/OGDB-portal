import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { Roles } from "../auth/roles.decorator";
import { CruisesService } from "./cruises.service";
import { CreateCruiseDto } from "./dto/create-cruise.dto";

@Controller("cruises")
export class CruisesController {
	constructor(private readonly cruises: CruisesService) {}

	@Get()
	findAll() {
		return this.cruises.findAll();
	}

	@Get(":id")
	findOne(@Param("id") id: string) {
		return this.cruises.findOne(Number(id));
	}

	@Roles("editor", "admin")
	@Post()
	create(@Body() dto: CreateCruiseDto) {
		return this.cruises.create(dto);
	}
}
