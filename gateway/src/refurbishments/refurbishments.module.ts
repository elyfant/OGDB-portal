import { Module } from "@nestjs/common";
import { ArgosTagsModule } from "../argos-tags/argos-tags.module";
import { BatteriesController } from "./batteries.controller";
import { BatteriesService } from "./batteries.service";
import { DeviceTestsController } from "./device-tests.controller";
import { DeviceTestsService } from "./device-tests.service";
import { FinalPrepController } from "./final-prep.controller";
import { FinalPrepService } from "./final-prep.service";
import { InspectionController } from "./inspection.controller";
import { InspectionService } from "./inspection.service";
import { IntakeController } from "./intake.controller";
import { IntakeService } from "./intake.service";
import { RefurbishmentsController } from "./refurbishments.controller";
import { RefurbishmentsService } from "./refurbishments.service";
import { SensorsController } from "./sensors.controller";
import { SensorsService } from "./sensors.service";
import { SoftwareController } from "./software.controller";
import { SoftwareService } from "./software.service";
import { TankRunsController } from "./tank-runs.controller";
import { TankRunsService } from "./tank-runs.service";
import { TestLinksController } from "./test-links.controller";
import { TestLinksService } from "./test-links.service";
import { VacuumController } from "./vacuum.controller";
import { VacuumService } from "./vacuum.service";

@Module({
	imports: [ArgosTagsModule],
	controllers: [
		RefurbishmentsController,
		TankRunsController,
		BatteriesController,
		DeviceTestsController,
		VacuumController,
		InspectionController,
		FinalPrepController,
		SoftwareController,
		IntakeController,
		TestLinksController,
		SensorsController,
	],
	providers: [
		RefurbishmentsService,
		TankRunsService,
		BatteriesService,
		DeviceTestsService,
		VacuumService,
		InspectionService,
		FinalPrepService,
		SoftwareService,
		IntakeService,
		TestLinksService,
		SensorsService,
	],
})
export class RefurbishmentsModule {}
