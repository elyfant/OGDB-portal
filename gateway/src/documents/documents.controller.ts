import { createReadStream } from "node:fs";
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

@Controller("documents")
export class DocumentsController {
	constructor(private readonly documents: DocumentsService) {}

	@Get(":id/file")
	async getFile(
		@Param("id", ParseIntPipe) id: number,
		@Res({ passthrough: true }) res: Response,
	): Promise<StreamableFile> {
		const { absolutePath, originalName } = await this.documents.getFilePath(id);
		res.set({
			"Content-Disposition": `attachment; filename="${originalName.replace(/"/g, "")}"`,
		});
		return new StreamableFile(createReadStream(absolutePath));
	}
}
