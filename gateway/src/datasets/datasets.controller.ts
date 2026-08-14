import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { DatasetsService } from "./datasets.service";

@Controller("datasets")
export class DatasetsController {
	constructor(private readonly datasets: DatasetsService) {}

	@Get()
	findAll() {
		return this.datasets.findAll();
	}

	@Get(":missionId")
	findDetail(@Param("missionId", ParseIntPipe) missionId: number) {
		return this.datasets.findDetail(missionId);
	}
}
