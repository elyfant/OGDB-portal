import { Controller, Get, Param } from "@nestjs/common";
import { CruisesService } from "./cruises.service";

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
}
