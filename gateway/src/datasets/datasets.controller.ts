import { Controller, Get } from "@nestjs/common";
import { DatasetsService } from "./datasets.service";

@Controller("datasets")
export class DatasetsController {
	constructor(private readonly datasets: DatasetsService) {}

	@Get()
	findAll() {
		return this.datasets.findAll();
	}
}
