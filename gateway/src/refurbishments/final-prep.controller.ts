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
import { FinalPrepService } from "./final-prep.service";
import { SCREENSHOT_INTERCEPTOR } from "./screenshot-upload";

@Controller("missions/:missionId/refurbishment/final-prep")
export class FinalPrepController {
	constructor(private readonly finalPrep: FinalPrepService) {}

	@Get()
	get(@Param("missionId", ParseIntPipe) missionId: number) {
		return this.finalPrep.get(missionId);
	}

	@Roles("editor", "admin")
	@Put()
	save(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Body() dto: SaveValuesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.finalPrep.save(missionId, dto.values, user.sub);
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
		return this.finalPrep.addScreenshots(missionId, files ?? [], user.sub);
	}

	@Roles("editor", "admin")
	@Delete("screenshots/:documentId")
	removeScreenshot(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Param("documentId", ParseIntPipe) documentId: number,
	) {
		return this.finalPrep.removeScreenshot(missionId, documentId);
	}
}
