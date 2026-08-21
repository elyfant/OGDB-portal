import {
	BadRequestException,
	Body,
	Controller,
	Get,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	Query,
	UploadedFile,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { AssetsService } from "./assets.service";
import { RecordSensorCalibrationDto } from "./dto/record-sensor-calibration.dto";
import { SetAssetStatusDto } from "./dto/set-asset-status.dto";

// Calibration certificates only -- one PDF per calibration entry (any
// bundling of multiple sub-certs into one file happens before upload,
// not something this endpoint handles).
const MAX_CERTIFICATE_BYTES = 20 * 1024 * 1024;

@Controller("assets")
export class AssetsController {
	constructor(private readonly assets: AssetsService) {}

	@Get()
	findAll() {
		return this.assets.findAll();
	}

	// Must come before :id — otherwise "search" gets swallowed as an id
	// param.
	@Get("search")
	search(@Query("type") type: string, @Query("q") q = "") {
		return this.assets.search(type, q);
	}

	@Get(":id")
	findOne(@Param("id", ParseIntPipe) id: number) {
		return this.assets.findOne(id);
	}

	@Roles("editor", "admin")
	@Patch(":id/status")
	setStatus(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: SetAssetStatusDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.assets.setStatus(id, dto, user.sub);
	}

	@Roles("editor", "admin")
	@Post(":id/calibrations")
	@UseInterceptors(
		FileInterceptor("certificate", {
			storage: memoryStorage(),
			limits: { fileSize: MAX_CERTIFICATE_BYTES },
			fileFilter: (_req, file, callback) => {
				if (file.mimetype !== "application/pdf") {
					callback(
						new BadRequestException("Certificates must be a PDF file."),
						false,
					);
					return;
				}
				callback(null, true);
			},
		}),
	)
	recordCalibration(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: RecordSensorCalibrationDto,
		@CurrentUser() user: JwtPayload,
		@UploadedFile() certificate?: Express.Multer.File,
	) {
		return this.assets.recordCalibration(id, dto, user.sub, certificate);
	}

	@Roles("editor", "admin")
	@Patch(":id/calibrations/:calId")
	@UseInterceptors(
		FileInterceptor("certificate", {
			storage: memoryStorage(),
			limits: { fileSize: MAX_CERTIFICATE_BYTES },
			fileFilter: (_req, file, callback) => {
				if (file.mimetype !== "application/pdf") {
					callback(
						new BadRequestException("Certificates must be a PDF file."),
						false,
					);
					return;
				}
				callback(null, true);
			},
		}),
	)
	updateCalibration(
		@Param("id", ParseIntPipe) id: number,
		@Param("calId", ParseIntPipe) calId: number,
		@Body() dto: RecordSensorCalibrationDto,
		@CurrentUser() user: JwtPayload,
		@UploadedFile() certificate?: Express.Multer.File,
	) {
		return this.assets.updateCalibration(id, calId, dto, user.sub, certificate);
	}
}
