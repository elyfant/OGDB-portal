import {
	Body,
	Controller,
	Get,
	Param,
	ParseIntPipe,
	Patch,
	Post,
} from "@nestjs/common";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { DatasetsService } from "./datasets.service";
import { ApplyDatasetStagesDto } from "./dto/apply-dataset-stages.dto";
import { ConfirmErddapPushDto } from "./dto/confirm-erddap-push.dto";
import { UpdateExternalReferencesDto } from "./dto/update-external-references.dto";

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

	@Roles("editor", "admin")
	@Post(":missionId/stages")
	applyStages(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Body() dto: ApplyDatasetStagesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.datasets.applyStages(missionId, dto, user.sub);
	}

	@Roles("editor", "admin")
	@Patch(":missionId/references")
	updateExternalReferences(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Body() dto: UpdateExternalReferencesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.datasets.updateExternalReferences(missionId, dto, user.sub);
	}

	@Roles("editor", "admin")
	@Post(":missionId/erddap-status")
	confirmErddapPush(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Body() dto: ConfirmErddapPushDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.datasets.confirmErddapPush(missionId, dto, user.sub);
	}
}
