import { extname } from "node:path";
import { BadRequestException } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";

// Argos tag test screenshots: images, or a PDF export of the Tag Agent.
const SCREENSHOT_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".pdf",
]);
const MAX_SCREENSHOT_BYTES = 10 * 1024 * 1024;

// Shared by every logsheet section that takes a tag test screenshot (the old
// tag at intake, the new tag in final prep).
export const SCREENSHOT_INTERCEPTOR = FilesInterceptor("files", 5, {
	storage: memoryStorage(),
	limits: { fileSize: MAX_SCREENSHOT_BYTES },
	fileFilter: (_req, file, callback) => {
		if (!SCREENSHOT_EXTENSIONS.has(extname(file.originalname).toLowerCase())) {
			callback(
				new BadRequestException(
					`"${file.originalname}" isn't an accepted file type. Use an image or a PDF.`,
				),
				false,
			);
			return;
		}
		callback(null, true);
	},
});
