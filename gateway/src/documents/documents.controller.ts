import { createReadStream } from "node:fs";
import path from "node:path";
import {
	Controller,
	Get,
	Param,
	ParseIntPipe,
	Res,
	StreamableFile,
} from "@nestjs/common";
import type { Response } from "express";
import { DocumentsService } from "./documents.service";

// Extension -> Content-Type for files we want the browser to render in
// its own tab rather than download. Mission key files are typically
// ascii/text (glider logs, config, csv), not PDFs -- serving those as
// text/plain is what makes them open inline. Anything not listed falls
// through to application/octet-stream (the browser decides, usually a
// download).
const INLINE_CONTENT_TYPES: Record<string, string> = {
	".pdf": "application/pdf",
	".txt": "text/plain; charset=utf-8",
	".text": "text/plain; charset=utf-8",
	".asc": "text/plain; charset=utf-8",
	".ascii": "text/plain; charset=utf-8",
	".dat": "text/plain; charset=utf-8",
	".log": "text/plain; charset=utf-8",
	".cfg": "text/plain; charset=utf-8",
	".ini": "text/plain; charset=utf-8",
	".m": "text/plain; charset=utf-8",
	".md": "text/plain; charset=utf-8",
	".csv": "text/csv; charset=utf-8",
	".tsv": "text/tab-separated-values; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".xml": "application/xml; charset=utf-8",
	".yaml": "text/plain; charset=utf-8",
	".yml": "text/plain; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
};

@Controller("documents")
export class DocumentsController {
	constructor(private readonly documents: DocumentsService) {}

	@Get(":id/file")
	async getFile(
		@Param("id", ParseIntPipe) id: number,
		@Res({ passthrough: true }) res: Response,
	): Promise<StreamableFile> {
		const { absolutePath, originalName } = await this.documents.getFilePath(id);
		const ext = path.extname(originalName).toLowerCase();
		const contentType = INLINE_CONTENT_TYPES[ext] ?? "application/octet-stream";
		// "inline" (not "attachment") so the browser renders the file in
		// its own tab instead of forcing a download -- the Key Files link
		// opens this with target="_blank".
		res.set({
			"Content-Type": contentType,
			"Content-Disposition": `inline; filename="${originalName.replace(/"/g, "")}"`,
		});
		return new StreamableFile(createReadStream(absolutePath));
	}
}
