import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseIntPipe,
	Post,
	Put,
	UploadedFiles,
	UseInterceptors,
} from "@nestjs/common";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { SaveValuesDto } from "./dto/save-values.dto";
import { IntakeService } from "./intake.service";
import { SCREENSHOT_INTERCEPTOR } from "./screenshot-upload";

@Controller("missions/:missionId/refurbishment/intake")
export class IntakeController {
	constructor(private readonly intake: IntakeService) {}

	@Get()
	get(@Param("missionId", ParseIntPipe) missionId: number) {
		return this.intake.get(missionId);
	}

	@Roles("editor", "admin")
	@Put()
	save(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Body() dto: SaveValuesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.intake.save(missionId, dto.values, user.sub);
	}

	@Roles("editor", "admin")
	@Post("screenshots")
	@HttpCode(201)
	@UseInterceptors(SCREENSHOT_INTERCEPTOR)
	addScreenshots(
		@Param("missionId", ParseIntPipe) missionId: number,
		@CurrentUser() user: JwtPayload,
		@UploadedFiles() files?: Express.Multer.File[],
	) {
		return this.intake.addScreenshots(missionId, files ?? [], user.sub);
	}

	@Roles("editor", "admin")
	@Delete("screenshots/:documentId")
	removeScreenshot(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Param("documentId", ParseIntPipe) documentId: number,
	) {
		return this.intake.removeScreenshot(missionId, documentId);
	}
}
