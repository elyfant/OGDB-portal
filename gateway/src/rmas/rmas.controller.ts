import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	UploadedFile,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { CreateRmaDto } from "./dto/create-rma.dto";
import { LinkRmaAssetDto } from "./dto/link-rma-asset.dto";
import { RecordRmaEventDto } from "./dto/record-rma-event.dto";
import { UpdateRmaAssetReasonDto } from "./dto/update-rma-asset-reason.dto";
import { UpdateRmaDto } from "./dto/update-rma.dto";
import { RmasService } from "./rmas.service";

// Whatever's on hand for a given step -- a shipping label, an AWB, a
// commercial invoice, a repair report. One PDF per step, same cap as
// every other attachment in this app.
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const ATTACHMENT_INTERCEPTOR = FileInterceptor("attachment", {
	storage: memoryStorage(),
	limits: { fileSize: MAX_ATTACHMENT_BYTES },
	fileFilter: (_req, file, callback) => {
		if (file.mimetype !== "application/pdf") {
			callback(
				new BadRequestException("Attachments must be a PDF file."),
				false,
			);
			return;
		}
		callback(null, true);
	},
});

@Controller("rmas")
export class RmasController {
	constructor(private readonly rmas: RmasService) {}

	@Get()
	getCatalogue() {
		return this.rmas.getCatalogue();
	}

	@Get(":id")
	getOne(@Param("id", ParseIntPipe) id: number) {
		return this.rmas.getOne(id);
	}

	@Get(":id/assets")
	getAssets(@Param("id", ParseIntPipe) id: number) {
		return this.rmas.getAssets(id);
	}

	@Get(":id/events")
	getEvents(@Param("id", ParseIntPipe) id: number) {
		return this.rmas.getEvents(id);
	}

	@Roles("editor", "admin")
	@Post()
	create(@Body() dto: CreateRmaDto, @CurrentUser() user: JwtPayload) {
		return this.rmas.create(dto, user.sub);
	}

	@Roles("editor", "admin")
	@Patch(":id")
	update(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: UpdateRmaDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.rmas.update(id, dto, user.sub);
	}

	@Roles("editor", "admin")
	@Post(":id/assets")
	linkAsset(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: LinkRmaAssetDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.rmas.linkAsset(id, dto, user.sub);
	}

	@Roles("editor", "admin")
	@Patch(":id/assets/:rmaAssetId")
	updateAssetReason(
		@Param("id", ParseIntPipe) id: number,
		@Param("rmaAssetId", ParseIntPipe) rmaAssetId: number,
		@Body() dto: UpdateRmaAssetReasonDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.rmas.updateAssetReason(id, rmaAssetId, dto, user.sub);
	}

	@Roles("editor", "admin")
	@Post(":id/events")
	@UseInterceptors(ATTACHMENT_INTERCEPTOR)
	recordEvent(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: RecordRmaEventDto,
		@CurrentUser() user: JwtPayload,
		@UploadedFile() attachment?: Express.Multer.File,
	) {
		return this.rmas.recordEvent(id, dto, user.sub, attachment);
	}

	@Roles("editor", "admin")
	@Patch(":id/events/:eventId")
	@UseInterceptors(ATTACHMENT_INTERCEPTOR)
	updateEvent(
		@Param("id", ParseIntPipe) id: number,
		@Param("eventId", ParseIntPipe) eventId: number,
		@Body() dto: RecordRmaEventDto,
		@CurrentUser() user: JwtPayload,
		@UploadedFile() attachment?: Express.Multer.File,
	) {
		return this.rmas.updateEvent(id, eventId, dto, user.sub, attachment);
	}
}
