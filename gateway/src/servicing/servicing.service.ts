import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { ServicingEvent, ServicingEventTypeOption } from "@ogdb/types";
import type { Pool, PoolClient } from "pg";
import { PG_POOL } from "../db/db.constants";
import {
	DocumentsService,
	originalNameFromReference,
} from "../documents/documents.service";
import type { RecordServicingEventDto } from "./dto/record-servicing-event.dto";

// The subset of asset_service_event_types this feature owns. Calibration
// already has its own dedicated flow (AssetsService.recordCalibration)
// and the rest (pressure_test, inspection, refurb, deployment_config)
// aren't exposed here -- deliberately narrow rather than "every type this
// table happens to allow". `missing`/`destroyed` are state-change events
// more than servicing; `destroyed` is terminal (see recordEvent).
const SERVICING_EVENT_TYPES = [
	"servicing",
	"factory_repair",
	"transit",
	"on_loan",
	"field_test",
	"missing",
	"destroyed",
] as const;

// Logging one of these retires the asset from the fleet -- the derived
// status view treats a `destroyed` event as terminal, and the asset's
// decommissioned_date is stamped here so the "Retired" tag shows without
// a second step.
const TERMINAL_EVENT_TYPES = new Set<string>(["destroyed"]);

// The one-open-event-per-asset rule (see assertNoOpenEvent) exists to
// stop genuinely contradictory concurrent state -- an asset can't be in
// transit AND in factory servicing at once. A terminal event doesn't fit
// that: it's deliberately never closed (there's no "un-destroyed" end
// date, see AddServicingEventDialog's isTerminal handling), so if it
// counted here it would permanently block logging anything else for that
// asset -- including backfilling a real event from before it was
// destroyed. Excluded from the check entirely rather than date-scoped,
// since a destroyed asset genuinely has nothing left to conflict with.
const BLOCKING_EVENT_TYPES = SERVICING_EVENT_TYPES.filter(
	(t) => !TERMINAL_EVENT_TYPES.has(t),
);

const SERVICING_ATTACHMENT_DOCUMENT_TYPE = "servicing_attachment";

const SELECT_SERVICING_EVENT = `
  SELECT
    se.id,
    se.asset_id AS "assetId",
    t.name AS "eventType",
    se.title,
    se.start_date AS "startDate",
    se.end_date AS "endDate",
    se.description AS details,
    se.performed_by_contact_id AS "performedByContactId",
    TRIM(c.first_name || ' ' || c.last_name) AS "performedByName",
    doc.id AS "documentId",
    doc.file_reference AS "documentFileReference"
  FROM asset_service_events se
  JOIN asset_service_event_types t ON t.id = se.event_type_id
  LEFT JOIN contacts c ON c.id = se.performed_by_contact_id
  LEFT JOIN LATERAL (
    SELECT id, file_reference FROM documents
    WHERE service_event_id = se.id
    ORDER BY created_at DESC LIMIT 1
  ) doc ON true
`;

@Injectable()
export class ServicingService {
	constructor(
		@Inject(PG_POOL) private readonly pool: Pool,
		private readonly documents: DocumentsService,
	) {}

	// The controlled list for the "Service event type" dropdown.
	async getEventTypes(): Promise<ServicingEventTypeOption[]> {
		const result = await this.pool.query(
			`SELECT id, name, description FROM asset_service_event_types
       WHERE name = ANY($1) ORDER BY name`,
			[SERVICING_EVENT_TYPES],
		);
		return result.rows;
	}

	async getForAsset(assetId: number): Promise<ServicingEvent[]> {
		const asset = await this.pool.query("SELECT id FROM assets WHERE id = $1", [
			assetId,
		]);
		if (asset.rows.length === 0) {
			throw new NotFoundException(`Asset ${assetId} not found`);
		}

		const result = await this.pool.query(
			`${SELECT_SERVICING_EVENT}
       WHERE se.asset_id = $1 AND t.name = ANY($2)
       ORDER BY se.start_date DESC`,
			[assetId, SERVICING_EVENT_TYPES],
		);
		return result.rows.map(({ documentFileReference, ...row }) => ({
			...row,
			documentName: documentFileReference
				? originalNameFromReference(documentFileReference)
				: null,
		}));
	}

	// The one-open-event-per-asset rule: a row with start_date set and
	// end_date still null is "in progress", and the UI won't let you log
	// another servicing event for the same asset until it's closed
	// (edited to add an end date). `excludeEventId` lets updateEvent
	// re-check without tripping over the very row it's editing.
	private async assertNoOpenEvent(
		assetId: number,
		excludeEventId?: number,
	): Promise<void> {
		const open = await this.pool.query(
			`SELECT se.id, se.title, t.name AS "eventType"
       FROM asset_service_events se
       JOIN asset_service_event_types t ON t.id = se.event_type_id
       WHERE se.asset_id = $1 AND t.name = ANY($2) AND se.end_date IS NULL
         AND se.id != $3
       LIMIT 1`,
			[assetId, BLOCKING_EVENT_TYPES, excludeEventId ?? -1],
		);
		if (open.rows.length > 0) {
			const row = open.rows[0];
			throw new ConflictException(
				`Asset ${assetId} has an open servicing event (${row.title ?? row.eventType}, id ${row.id}) — close it before adding another.`,
			);
		}
	}

	// start/end are IsDateString'd 'YYYY-MM-DD' -- lexical compare is date
	// order. Backstopped by a CHECK constraint (see the
	// asset_service_events_date_check migration); this is just the
	// friendlier error.
	private assertDateOrder(dto: RecordServicingEventDto): void {
		if (dto.endDate && dto.endDate < dto.startDate) {
			throw new BadRequestException("End date can't be before the start date.");
		}
	}

	private async resolveEventTypeId(eventType: string): Promise<number> {
		const result = await this.pool.query(
			"SELECT id FROM asset_service_event_types WHERE name = $1 AND name = ANY($2)",
			[eventType, SERVICING_EVENT_TYPES],
		);
		if (result.rows.length === 0) {
			throw new BadRequestException(
				`Unknown servicing event type: ${eventType}`,
			);
		}
		return result.rows[0].id;
	}

	private async attachFile(
		client: PoolClient,
		assetId: number,
		eventId: number,
		attachment: Express.Multer.File,
		userId: number,
	): Promise<void> {
		const { fileReference } = await this.documents.saveUploadedFile(attachment);
		await this.documents.createDocumentRecord(client, {
			assetId,
			serviceEventId: eventId,
			documentType: SERVICING_ATTACHMENT_DOCUMENT_TYPE,
			fileReference,
			changedBy: userId,
		});
	}

	// Always an INSERT -- same append-only convention as
	// AssetsService.recordCalibration and everywhere else ("current" is
	// just whichever row has no end_date yet).
	async recordEvent(
		assetId: number,
		dto: RecordServicingEventDto,
		userId: number,
		attachment?: Express.Multer.File,
	): Promise<void> {
		const asset = await this.pool.query("SELECT id FROM assets WHERE id = $1", [
			assetId,
		]);
		if (asset.rows.length === 0) {
			throw new NotFoundException(`Asset ${assetId} not found`);
		}

		this.assertDateOrder(dto);
		const eventTypeId = await this.resolveEventTypeId(dto.eventType);
		const terminal = TERMINAL_EVENT_TYPES.has(dto.eventType);
		// A terminal event (destroyed) is allowed even while another event
		// is open -- it closes that one below. Everything else obeys the
		// one-open-event-per-asset rule.
		if (!terminal) {
			await this.assertNoOpenEvent(assetId);
		}

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");

			if (terminal) {
				// Close any still-open event as of the terminal date, then
				// retire the asset. Destruction is the strongest retirement
				// claim, so it sets the date/reason even if the asset was
				// already flagged retired (e.g. a rough earlier import) --
				// return-to-service + re-log undoes a mistake.
				await client.query(
					`UPDATE asset_service_events SET end_date = $2, changed_by = $3
           WHERE asset_id = $1 AND end_date IS NULL`,
					[assetId, dto.startDate, userId],
				);
				await client.query(
					`UPDATE assets
             SET decommissioned_date = $2, decommission_reason = $3,
                 updated_at = now(), changed_by = $4
           WHERE id = $1`,
					[assetId, dto.startDate, dto.eventType, userId],
				);
			}

			const insert = await client.query(
				`INSERT INTO asset_service_events
           (asset_id, event_type_id, title, start_date, end_date, description, performed_by_contact_id, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
				[
					assetId,
					eventTypeId,
					dto.title,
					dto.startDate,
					dto.endDate ?? null,
					dto.details ?? null,
					dto.performedByContactId ?? null,
					userId,
				],
			);
			const eventId = insert.rows[0].id;

			if (attachment) {
				await this.attachFile(client, assetId, eventId, attachment, userId);
			}

			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}
	}

	// Full-replace PATCH, same convention as AssetsService.updateCalibration
	// -- correcting or completing an already-recorded event, not logging a
	// new one. This is also how the UI closes an open event: edit it, fill
	// in End date, save.
	async updateEvent(
		assetId: number,
		eventId: number,
		dto: RecordServicingEventDto,
		userId: number,
		attachment?: Express.Multer.File,
	): Promise<void> {
		this.assertDateOrder(dto);
		const eventTypeId = await this.resolveEventTypeId(dto.eventType);

		// Only worth re-checking "no open event" when this edit would
		// leave the row open -- an edit that's setting/keeping an end
		// date can never conflict with anything.
		if (!dto.endDate) {
			await this.assertNoOpenEvent(assetId, eventId);
		}

		const client = await this.pool.connect();
		try {
			await client.query("BEGIN");

			const existing = await client.query(
				`SELECT asset_id FROM asset_service_events WHERE id = $1 FOR UPDATE`,
				[eventId],
			);
			if (existing.rows.length === 0 || existing.rows[0].asset_id !== assetId) {
				throw new NotFoundException(
					`Servicing event ${eventId} not found for asset ${assetId}.`,
				);
			}

			await client.query(
				`UPDATE asset_service_events
         SET event_type_id = $1, title = $2, start_date = $3, end_date = $4,
             description = $5, performed_by_contact_id = $6, changed_by = $7
         WHERE id = $8`,
				[
					eventTypeId,
					dto.title,
					dto.startDate,
					dto.endDate ?? null,
					dto.details ?? null,
					dto.performedByContactId ?? null,
					userId,
					eventId,
				],
			);

			if (attachment) {
				await this.attachFile(client, assetId, eventId, attachment, userId);
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
