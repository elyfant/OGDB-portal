import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Pool, PoolClient } from "pg";
import { PG_POOL } from "../db/db.constants";

// Files live on a Docker named volume mounted at DOCUMENTS_DIR (see
// docker-compose.yml) -- NOT Nextcloud, NOT the container's own
// writable layer (which `docker compose up -d --build` wipes on every
// deploy). Falls back to a local ./storage/documents path outside
// Docker (dev/tests).
const DOCUMENTS_DIR = process.env.DOCUMENTS_DIR ?? "./storage/documents";

export interface StoredFile {
	// Relative path under DOCUMENTS_DIR -- what documents.file_reference
	// stores. The UUID prefix guarantees no collision; keeping the
	// original (sanitized) filename after it means the on-disk name is
	// still human-readable without needing a separate "original name"
	// column.
	fileReference: string;
	originalName: string;
}

function sanitizeFilename(name: string): string {
	return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
}

// Matches fileReference values produced by saveUploadedFile: a v4 UUID,
// a dash, then the sanitized original name. Historical rows backfilled
// before this VM-storage design store the original legacy share path
// instead (e.g. "/Data/gfi/projects/.../CERT.pdf") and don't match this.
const LOCAL_FILE_REFERENCE_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i;

@Injectable()
export class DocumentsService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	async saveUploadedFile(file: Express.Multer.File): Promise<StoredFile> {
		await mkdir(DOCUMENTS_DIR, { recursive: true });
		const fileReference = `${randomUUID()}-${sanitizeFilename(file.originalname)}`;
		await writeFile(path.join(DOCUMENTS_DIR, fileReference), file.buffer);
		return { fileReference, originalName: file.originalname };
	}

	// Same shape, but takes an already-open transaction client so it can
	// be part of a larger atomic write (e.g. recordCalibration's
	// cal-row + service-event + document insert).
	async createDocumentRecord(
		client: PoolClient,
		params: {
			assetId?: number;
			serviceEventId?: number;
			documentType: string;
			fileReference: string;
			notes?: string | null;
			changedBy: number;
		},
	): Promise<number> {
		const result = await client.query(
			`INSERT INTO documents (asset_id, service_event_id, document_type, file_reference, notes, changed_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
			[
				params.assetId ?? null,
				params.serviceEventId ?? null,
				params.documentType,
				params.fileReference,
				params.notes ?? null,
				params.changedBy,
			],
		);
		return result.rows[0].id;
	}

	async getFilePath(
		id: number,
	): Promise<{ absolutePath: string; originalName: string }> {
		const result = await this.pool.query(
			"SELECT file_reference FROM documents WHERE id = $1",
			[id],
		);
		if (result.rows.length === 0) {
			throw new NotFoundException(`Document ${id} not found`);
		}
		const fileReference: string = result.rows[0].file_reference;
		const match = fileReference.match(LOCAL_FILE_REFERENCE_PATTERN);
		if (!match) {
			// A legacy file_reference pointing at the old network share --
			// never copied onto this VM, so there's nothing to stream.
			throw new NotFoundException(
				`Document ${id} references a legacy file path that isn't stored on this server: ${fileReference}`,
			);
		}
		return {
			absolutePath: path.join(DOCUMENTS_DIR, fileReference),
			originalName: match[1],
		};
	}
}
