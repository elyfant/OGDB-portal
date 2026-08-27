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
import { CalibrationsService } from "../calibrations/calibrations.service";
import { RecordServicingEventDto } from "../servicing/dto/record-servicing-event.dto";
import { ServicingService } from "../servicing/servicing.service";
import { AssetsService } from "./assets.service";
import { CertificateParserService } from "./certificate-parser.service";
import { CreateAssetDto } from "./dto/create-asset.dto";
import { RecordSensorCalibrationDto } from "./dto/record-sensor-calibration.dto";
import { SetAssetStatusDto } from "./dto/set-asset-status.dto";
import { UpdateAssetDto } from "./dto/update-asset.dto";

// Calibration certificates only -- one PDF per calibration entry (any
// bundling of multiple sub-certs into one file happens before upload,
// not something this endpoint handles).
const MAX_CERTIFICATE_BYTES = 20 * 1024 * 1024;

// Shared by every endpoint that accepts a certificate upload (record,
// update, and the read-only parse-preview below) -- one PDF-only,
// size-capped multipart field named "certificate".
const CERTIFICATE_INTERCEPTOR = FileInterceptor("certificate", {
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
});

// Servicing events attach an optional PDF the same way a calibration
// certificate does, just under its own field name ("attachment") since
// it isn't a certificate.
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

@Controller("assets")
export class AssetsController {
	constructor(
		private readonly assets: AssetsService,
		private readonly certificateParser: CertificateParserService,
		private readonly calibrations: CalibrationsService,
		private readonly servicing: ServicingService,
	) {}

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

	// Same reason: must come before :id.
	@Get("batteries")
	findBatteries() {
		return this.assets.findBatteries();
	}

	// Same reason: must come before :id.
	@Get("servicing-event-types")
	getServicingEventTypes() {
		return this.servicing.getEventTypes();
	}

	@Get(":id")
	findOne(@Param("id", ParseIntPipe) id: number) {
		return this.assets.findOne(id);
	}

	@Roles("editor", "admin")
	@Post()
	create(@Body() dto: CreateAssetDto, @CurrentUser() user: JwtPayload) {
		return this.assets.create(dto, user.sub);
	}

	@Roles("editor", "admin")
	@Patch(":id")
	update(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: UpdateAssetDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.assets.update(id, dto, user.sub);
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

	@Get(":id/calibrations")
	getCalibrations(@Param("id", ParseIntPipe) id: number) {
		return this.calibrations.getForAsset(id);
	}

	@Get(":id/battery")
	getBattery(@Param("id", ParseIntPipe) id: number) {
		return this.assets.getBatteryForAsset(id);
	}

	@Roles("editor", "admin")
	@Post(":id/calibrations")
	@UseInterceptors(CERTIFICATE_INTERCEPTOR)
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
	@UseInterceptors(CERTIFICATE_INTERCEPTOR)
	updateCalibration(
		@Param("id", ParseIntPipe) id: number,
		@Param("calId", ParseIntPipe) calId: number,
		@Body() dto: RecordSensorCalibrationDto,
		@CurrentUser() user: JwtPayload,
		@UploadedFile() certificate?: Express.Multer.File,
	) {
		return this.assets.updateCalibration(id, calId, dto, user.sub, certificate);
	}

	@Get(":id/servicing")
	getServicingEvents(@Param("id", ParseIntPipe) id: number) {
		return this.servicing.getForAsset(id);
	}

	@Roles("editor", "admin")
	@Post(":id/servicing")
	@UseInterceptors(ATTACHMENT_INTERCEPTOR)
	recordServicingEvent(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: RecordServicingEventDto,
		@CurrentUser() user: JwtPayload,
		@UploadedFile() attachment?: Express.Multer.File,
	) {
		return this.servicing.recordEvent(id, dto, user.sub, attachment);
	}

	// Also how the UI closes an open event -- edit it, fill in End date,
	// save (see ServicingService.updateEvent).
	@Roles("editor", "admin")
	@Patch(":id/servicing/:eventId")
	@UseInterceptors(ATTACHMENT_INTERCEPTOR)
	updateServicingEvent(
		@Param("id", ParseIntPipe) id: number,
		@Param("eventId", ParseIntPipe) eventId: number,
		@Body() dto: RecordServicingEventDto,
		@CurrentUser() user: JwtPayload,
		@UploadedFile() attachment?: Express.Multer.File,
	) {
		return this.servicing.updateEvent(id, eventId, dto, user.sub, attachment);
	}

	// Read-only preview: extracts coefficients/facility/date from an
	// uploaded certificate without saving anything. The dialog uses this
	// to populate its fields immediately on file selection, well before
	// the user hits Save -- the actual certificate only gets persisted
	// (via recordCalibration/updateCalibration) once they do.
	@Roles("editor", "admin")
	@Post(":id/calibrations/parse-certificate")
	@UseInterceptors(CERTIFICATE_INTERCEPTOR)
	async parseCertificate(
		@Param("id", ParseIntPipe) id: number,
		@UploadedFile() certificate?: Express.Multer.File,
	) {
		if (!certificate) {
			throw new BadRequestException("No certificate file provided.");
		}
		const asset = await this.assets.findOne(id);
		return this.certificateParser.parse(certificate.buffer, asset.serialNumber);
	}
}
