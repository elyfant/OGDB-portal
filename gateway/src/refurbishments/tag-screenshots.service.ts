import {
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { RefurbTagScreenshot } from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import {
	DocumentsService,
	originalNameFromReference,
} from "../documents/documents.service";

// Argos tag test screenshots are documents owned by the mission, told apart
// by document type, so they need no column of their own and show up wherever
// the mission's documents do. One type per tag: the old tag at intake and the
// new tag in final prep.
export const OLD_TAG_SCREENSHOT_TYPE = "refurb_old_argos_test";
export const NEW_TAG_SCREENSHOT_TYPE = "refurb_argos_test";

@Injectable()
export class TagScreenshotsService {
	constructor(
		@Inject(PG_POOL) private readonly pool: Pool,
		private readonly documents: DocumentsService,
	) {}

	async list(
		missionId: number,
		documentType: string,
	): Promise<RefurbTagScreenshot[]> {
		const r = await this.pool.query(
			`SELECT id, file_reference, created_at AS "uploadedAt"
         FROM documents WHERE mission_id = $1 AND document_type = $2
        ORDER BY created_at, id`,
			[missionId, documentType],
		);
		return r.rows.map((d) => ({
			id: d.id,
			fileName: originalNameFromReference(d.file_reference),
			uploadedAt: d.uploadedAt,
		}));
	}

	async add(
		missionId: number,
		documentType: string,
		files: Express.Multer.File[],
		userId: number,
	): Promise<void> {
		if (files.length === 0) {
			throw new BadRequestException("Choose a screenshot to upload.");
		}
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			for (const file of files) {
				const { fileReference } = await this.documents.saveUploadedFile(file);
				await this.documents.createDocumentRecord(client, {
					missionId,
					documentType,
					fileReference,
					changedBy: userId,
				});
			}
			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}
	}

	async remove(
		missionId: number,
		documentType: string,
		documentId: number,
	): Promise<void> {
		const res = await this.pool.query(
			`DELETE FROM documents
        WHERE id = $1 AND mission_id = $2 AND document_type = $3
        RETURNING file_reference`,
			[documentId, missionId, documentType],
		);
		if (res.rows.length === 0) {
			throw new NotFoundException(`Screenshot ${documentId} not found.`);
		}
		await this.documents.removeFile(res.rows[0].file_reference);
	}
}
