import {
	Body,
	Controller,
	Get,
	Param,
	ParseIntPipe,
	Post,
} from "@nestjs/common";
import { Roles } from "../auth/roles.decorator";
import { CreateProcessingPackageVersionDto } from "./dto/create-processing-package-version.dto";
import { CreateProcessingPackageDto } from "./dto/create-processing-package.dto";
import { ProcessingPackagesService } from "./processing-packages.service";

@Controller("processing-packages")
export class ProcessingPackagesController {
	constructor(private readonly packages: ProcessingPackagesService) {}

	@Get()
	findAll() {
		return this.packages.findAll();
	}

	@Roles("editor", "admin")
	@Post()
	create(@Body() dto: CreateProcessingPackageDto) {
		return this.packages.create(dto);
	}

	@Roles("editor", "admin")
	@Post(":id/versions")
	createVersion(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: CreateProcessingPackageVersionDto,
	) {
		return this.packages.createVersion(id, dto);
	}
}
