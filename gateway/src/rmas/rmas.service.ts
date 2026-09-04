import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	AssetRmaSummary,
	Rma,
	RmaAsset,
	RmaCatalogueRow,
	RmaEvent,
} from "@ogdb/types";
import type { Pool, PoolClient } from "pg";
import { PG_POOL } from "../db/db.constants";
import {
	DocumentsService,
	originalNameFromReference,
} from "../documents/documents.service";
import type { CreateRmaDto } from "./dto/create-rma.dto";
import type { LinkRmaAssetDto } from "./dto/link-rma-asset.dto";
import type { RecordRmaEventDto } from "./dto/record-rma-event.dto";
import type { UpdateRmaAssetReasonDto } from "./dto/update-rma-asset-reason.dto";
import type { UpdateRmaDto } from "./dto/update-rma.dto";

// Every rma_events.event_type -- validated server-side (belt-and-
// suspenders alongside the DB's ck_rma_events_type CHECK), same
// allowlist ServicingService.resolveEventTypeId enforces for its own
// event types.
const RMA_EVENT_TYPES = [
	"opened",
	"shipped_out",
	"received_by_repairer",
	"status_update",
	"escalated_to_manufacturer",
	"shipping_issue",
	"received_by_manufacturer",
	"returned",
	"closed",
];

const RMA_EVENT_ATTACHMENT_DOCUMENT_TYPE = "rma_event_attachment";

// Latest document per event, same LATERAL + LIMIT 1 pattern
// SELECT_SERVICING_EVENT uses against service_event_id -- can never
// multiply rows even if more than one document ever ends up on the same
// step.
const SELECT_RMA_EVENT = `
  SELECT
    re.id,
    re.rma_id AS "rmaId",
    re.event_type AS "eventType",
    re.event_date AS "eventDate",
    re.facility_id AS "facilityId",
    m.name AS "facilityName",
    re.reference_number AS "referenceNumber",
    re.notes,
    doc.id AS "documentId",
    doc.file_reference AS "documentFileReference"
  FROM rma_events re
  LEFT JOIN manufacturers m ON m.id = re.facility_id
  LEFT JOIN LATERAL (
    SELECT id, file_reference FROM documents
    WHERE rma_event_id = re.id
    ORDER BY created_at DESC LIMIT 1
  ) doc ON true
`;

@Injectable()
export class RmasService {
	constructor(
		@Inject(PG_POOL) private readonly pool: Pool,
		private readonly documents: DocumentsService,
	) {}

	// Every RMA, newest first, with its derived current stage/status
	// (current_rma_status -- LEFT JOIN since a brand-new RMA has no rows
	// there until create()'s own "opened" event lands, though in
	// practice that never happens since create() inserts both in one
	// transaction) and an asset-count/serials summary for the list view.
	async getCatalogue(): Promise<RmaCatalogueRow[]> {
		const result = await this.pool.query(
			`SELECT r.id, r.rma_number AS "rmaNumber", m.name AS "manufacturerName",
              r.opened_date AS "openedDate",
              COALESCE(crs.current_stage, 'opened') AS "currentStage",
              COALESCE(crs.current_stage, 'opened') <> 'closed' AS open,
              COUNT(ra.id)::int AS "assetCount",
              COALESCE(array_agg(a.serial_number ORDER BY a.serial_number) FILTER (WHERE a.serial_number IS NOT NULL), '{}') AS "assetSerials"
       FROM rmas r
       JOIN manufacturers m ON m.id = r.manufacturer_id
       LEFT JOIN current_rma_status crs ON crs.rma_id = r.id
       LEFT JOIN rma_assets ra ON ra.rma_id = r.id
       LEFT JOIN assets a ON a.id = ra.asset_id
       GROUP BY r.id, m.name, crs.current_stage
       ORDER BY r.opened_date DESC, r.id DESC`,
		);
		return result.rows;
	}

	async getOne(id: number): Promise<Rma> {
		const result = await this.pool.query(
			`SELECT r.id, r.rma_number AS "rmaNumber", r.manufacturer_id AS "manufacturerId",
              m.name AS "manufacturerName", r.opened_date AS "openedDate", r.notes
       FROM rmas r
       JOIN manufacturers m ON m.id = r.manufacturer_id
       WHERE r.id = $1`,
			[id],
		);
		if (result.rows.length === 0) {
			throw new NotFoundException(`RMA ${id} not found`);
		}
		return result.rows[0];
	}

	async getAssets(rmaId: number): Promise<RmaAsset[]> {
		await this.getOne(rmaId);
		const result = await this.pool.query(
			`SELECT ra.id, ra.rma_id AS "rmaId", ra.asset_id AS "assetId",
              a.serial_number AS "assetSerialNumber", at.name AS "assetType",
              ra.reason
       FROM rma_assets ra
       JOIN assets a ON a.id = ra.asset_id
       JOIN asset_types at ON at.id = a.asset_type_id
       WHERE ra.rma_id = $1
       ORDER BY ra.id`,
			[rmaId],
		);
		return result.rows;
	}

	async getEvents(rmaId: number): Promise<RmaEvent[]> {
		await this.getOne(rmaId);
		const result = await this.pool.query(
			`${SELECT_RMA_EVENT}
       WHERE re.rma_id = $1
       ORDER BY re.event_date, re.id`,
			[rmaId],
		);
		return result.rows.map(({ documentFileReference, ...row }) => ({
			...row,
			documentName: documentFileReference
				? originalNameFromReference(documentFileReference)
				: null,
		}));
	}

	// The thin per-asset feed -- the asset-timeline counterpart to
	// MissionsService.getForAsset, just walking rma_assets/rmas instead
	// of asset_assignments/missions. closedDate rides on current_rma_
	// status's own event_date, only surfaced once currentStage is
	// "closed" -- there's no separate "closed_date" column to keep in
	// sync.
	async getForAsset(assetId: number): Promise<AssetRmaSummary[]> {
		const asset = await this.pool.query("SELECT 1 FROM assets WHERE id = $1", [
			assetId,
		]);
		if (asset.rows.length === 0) {
			throw new NotFoundException(`Asset ${assetId} not found`);
		}

		const result = await this.pool.query(
			`SELECT r.id AS "rmaId", r.rma_number AS "rmaNumber", ra.reason,
              r.opened_date AS "openedDate",
              COALESCE(crs.current_stage, 'opened') AS "currentStage",
              CASE WHEN crs.current_stage = 'closed' THEN crs.event_date END AS "closedDate",
              COALESCE(crs.current_stage, 'opened') <> 'closed' AS open
       FROM rma_assets ra
       JOIN rmas r ON r.id = ra.rma_id
       LEFT JOIN current_rma_status crs ON crs.rma_id = r.id
       WHERE ra.asset_id = $1
       ORDER BY r.opened_date DESC, r.id DESC`,
			[assetId],
		);
		return result.rows;
	}

	// Always inserts an "opened" rma_events row alongside the rmas row,
	// in the same transaction -- without it, a brand-new RMA has no
	// current_rma_status row and nothing to show as "current stage"
	// until someone manually logs a first real step.
	async create(dto: CreateRmaDto, userId: number): Promise<Rma> {
		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			const insert = await client.query(
				`INSERT INTO rmas (rma_number, manufacturer_id, opened_date, notes, changed_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
				[
					dto.rmaNumber ?? null,
					dto.manufacturerId,
					dto.openedDate,
					dto.notes ?? null,
					userId,
				],
			);
			const rmaId = insert.rows[0].id;
			await client.query(
				`INSERT INTO rma_events (rma_id, event_type, event_date, changed_by)
         VALUES ($1, 'opened', $2, $3)`,
				[rmaId, dto.openedDate, userId],
			);
			await client.query("COMMIT");
			return this.getOne(rmaId);
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}
	}

	// Full-replace PATCH, same convention as MissionsService.updateMission
	// -- correcting the case header (a typo'd rma_number, the wrong
	// manufacturer), not logging a new step.
	async update(id: number, dto: UpdateRmaDto, userId: number): Promise<Rma> {
		await this.getOne(id);
		await this.pool.query(
			`UPDATE rmas SET
         rma_number = $1, manufacturer_id = COALESCE($2, manufacturer_id),
         opened_date = COALESCE($3, opened_date), notes = $4,
         updated_at = now(), changed_by = $6
       WHERE id = $5`,
			[
				dto.rmaNumber ?? null,
				dto.manufacturerId ?? null,
				dto.openedDate ?? null,
				dto.notes ?? null,
				id,
				userId,
			],
		);
		return this.getOne(id);
	}

	async linkAsset(
		rmaId: number,
		dto: LinkRmaAssetDto,
		userId: number,
	): Promise<RmaAsset> {
		await this.getOne(rmaId);
		try {
			const insert = await this.pool.query(
				`INSERT INTO rma_assets (rma_id, asset_id, reason, changed_by)
         VALUES ($1, $2, $3, $4) RETURNING id`,
				[rmaId, dto.assetId, dto.reason, userId],
			);
			const rows = await this.getAssets(rmaId);
			return rows.find((r) => r.id === insert.rows[0].id) as RmaAsset;
		} catch (err) {
			if (isUniqueViolation(err)) {
				throw new ConflictException(
					`Asset ${dto.assetId} is already linked to this RMA.`,
				);
			}
			if (isFkViolation(err)) {
				throw new ConflictException(`Asset ${dto.assetId} does not exist.`);
			}
			throw err instanceof Error ? err : new Error(String(err));
		}
	}

	// Fiona's own explicit ask: the reason for each linked asset needs
	// to stay editable after the fact -- it's context ("Dvalin-873 aft
	// leak 2024 sep, nick partly across aft o-ring face") that isn't
	// recoverable from the manufacturer/asset number alone.
	async updateAssetReason(
		rmaId: number,
		rmaAssetId: number,
		dto: UpdateRmaAssetReasonDto,
		userId: number,
	): Promise<RmaAsset> {
		const existing = await this.pool.query(
			"SELECT rma_id FROM rma_assets WHERE id = $1",
			[rmaAssetId],
		);
		if (existing.rows.length === 0 || existing.rows[0].rma_id !== rmaId) {
			throw new NotFoundException(
				`Linked asset ${rmaAssetId} not found for RMA ${rmaId}.`,
			);
		}
		await this.pool.query(
			"UPDATE rma_assets SET reason = $1, changed_by = $2 WHERE id = $3",
			[dto.reason, userId, rmaAssetId],
		);
		const rows = await this.getAssets(rmaId);
		return rows.find((r) => r.id === rmaAssetId) as RmaAsset;
	}

	private async attachFile(
		client: PoolClient,
		eventId: number,
		attachment: Express.Multer.File,
		userId: number,
	): Promise<void> {
		const { fileReference } = await this.documents.saveUploadedFile(attachment);
		await this.documents.createDocumentRecord(client, {
			rmaEventId: eventId,
			documentType: RMA_EVENT_ATTACHMENT_DOCUMENT_TYPE,
			fileReference,
			changedBy: userId,
		});
	}

	// Always an INSERT -- rma_events is append-only, same convention as
	// asset_service_events and every other history table in this app.
	async recordEvent(
		rmaId: number,
		dto: RecordRmaEventDto,
		userId: number,
		attachment?: Express.Multer.File,
	): Promise<void> {
		await this.getOne(rmaId);
		if (!RMA_EVENT_TYPES.includes(dto.eventType)) {
			throw new ConflictException(`Unknown RMA event type: ${dto.eventType}`);
		}

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			const insert = await client.query(
				`INSERT INTO rma_events (rma_id, event_type, event_date, facility_id, reference_number, notes, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
				[
					rmaId,
					dto.eventType,
					dto.eventDate,
					dto.facilityId ?? null,
					dto.referenceNumber ?? null,
					dto.notes ?? null,
					userId,
				],
			);
			if (attachment) {
				await this.attachFile(client, insert.rows[0].id, attachment, userId);
			}
			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}
	}

	// Full-replace PATCH, same convention as ServicingService.updateEvent
	// -- correcting an already-recorded step (a wrong date, a missed
	// attachment), not logging a new one.
	async updateEvent(
		rmaId: number,
		eventId: number,
		dto: RecordRmaEventDto,
		userId: number,
		attachment?: Express.Multer.File,
	): Promise<void> {
		await this.getOne(rmaId);
		if (!RMA_EVENT_TYPES.includes(dto.eventType)) {
			throw new ConflictException(`Unknown RMA event type: ${dto.eventType}`);
		}

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");
			const existing = await client.query(
				"SELECT rma_id FROM rma_events WHERE id = $1 FOR UPDATE",
				[eventId],
			);
			if (existing.rows.length === 0 || existing.rows[0].rma_id !== rmaId) {
				throw new NotFoundException(
					`Event ${eventId} not found for RMA ${rmaId}.`,
				);
			}

			await client.query(
				`UPDATE rma_events SET
           event_type = $1, event_date = $2, facility_id = $3,
           reference_number = $4, notes = $5, changed_by = $6
         WHERE id = $7`,
				[
					dto.eventType,
					dto.eventDate,
					dto.facilityId ?? null,
					dto.referenceNumber ?? null,
					dto.notes ?? null,
					userId,
					eventId,
				],
			);
			if (attachment) {
				await this.attachFile(client, eventId, attachment, userId);
			}
			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}
	}
}

function isFkViolation(err: unknown): boolean {
	return (
		!!err &&
		typeof err === "object" &&
		"code" in err &&
		(err as { code: string }).code === "23503"
	);
}

function isUniqueViolation(err: unknown): boolean {
	return (
		!!err &&
		typeof err === "object" &&
		"code" in err &&
		(err as { code: string }).code === "23505"
	);
}
