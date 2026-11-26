import {
	BadRequestException,
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	ServicingEvent,
	ServicingEventTypeOption,
	ServicingRequired,
} from "@ogdb/types";
import type { Pool, PoolClient } from "pg";
import { PG_POOL } from "../db/db.constants";
import {
	DocumentsService,
	originalNameFromReference,
} from "../documents/documents.service";
import {
	retireComponentsTx,
	withdrawClearancesForAssetTx,
} from "../gliders/build.helpers";
import type { RecordServicingEventDto } from "./dto/record-servicing-event.dto";
import type { ResolveServicingRequiredDto } from "./dto/resolve-servicing-required.dto";

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
	"pre_mission_servicing",
	"servicing_required",
] as const;

// "Servicing required" (do not deploy) is a FLAG on an asset, not a state: it
// stays open until resolved, never changes a glider's derived status, and
// coexists with every other event -- a glider can be in transit AND need
// servicing. So it neither blocks nor is blocked by the one-open-event rule
// (see BLOCKING_EVENT_TYPES), and has its own one-open-per-asset rule.
// Resolving it sets its end date; the event stays on the timeline.
const FLAG_EVENT_TYPE = "servicing_required";

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
	(t) => !TERMINAL_EVENT_TYPES.has(t) && t !== FLAG_EVENT_TYPE,
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
	// end_date still null is "in progress" as of today onward. That's
	// only a genuine conflict for a *new* event dated on or after the
	// open one's own start -- claiming two things are both "current" at
	// once. A new event dated strictly before it is pure backfill (the
	// open event hadn't started yet), which is always fine -- same
	// reasoning that already exempted terminal events (destroyed)
	// entirely, generalized here to a date check so it applies to every
	// type, not just terminal ones. `excludeEventId` lets updateEvent
	// re-check without tripping over the very row it's editing.
	private async assertNoOpenEvent(
		assetId: number,
		newStartDate: string,
		excludeEventId?: number,
	): Promise<void> {
		const open = await this.pool.query(
			`SELECT se.id, se.title, t.name AS "eventType"
       FROM asset_service_events se
       JOIN asset_service_event_types t ON t.id = se.event_type_id
       WHERE se.asset_id = $1 AND t.name = ANY($2) AND se.end_date IS NULL
         AND se.id != $3 AND se.start_date <= $4
       LIMIT 1`,
			[assetId, BLOCKING_EVENT_TYPES, excludeEventId ?? -1, newStartDate],
		);
		if (open.rows.length > 0) {
			const row = open.rows[0];
			throw new ConflictException(
				`Asset ${assetId} has an open servicing event (${row.title ?? row.eventType}, id ${row.id}) — close it before adding another dated on or after it started.`,
			);
		}
	}

	// A destroyed asset has no future: nothing can happen to it after the day
	// it was destroyed. (docs/design/glider-state-and-location.md section 7.)
	// Backfilling an earlier event is still fine -- that is the point of the
	// comment on BLOCKING_EVENT_TYPES -- as long as it ends by then.
	//   * logging the destruction itself: refused if one is already on record
	//     (edit that one), or if events already run past that day;
	//   * logging anything else: refused if it starts or ends after the
	//     destruction, or is still open (an open event on a destroyed asset
	//     is a contradiction). `excludeEventId` lets an edit skip its own row.
	// Dates are compared as 'YYYY-MM-DD' strings (lexical = date order).
	private async assertConsistentWithDestruction(
		assetId: number,
		dto: RecordServicingEventDto,
		excludeEventId?: number,
	): Promise<void> {
		const start = dto.startDate.slice(0, 10);
		const end = dto.endDate?.slice(0, 10);

		const destroyed = await this.pool.query(
			`SELECT se.start_date AS "startDate"
       FROM asset_service_events se
       JOIN asset_service_event_types t ON t.id = se.event_type_id
       WHERE se.asset_id = $1 AND t.name = 'destroyed' AND se.id <> $2
       ORDER BY se.start_date LIMIT 1`,
			[assetId, excludeEventId ?? -1],
		);
		const destroyedOn: string | undefined = destroyed.rows[0]?.startDate;

		if (TERMINAL_EVENT_TYPES.has(dto.eventType)) {
			if (destroyedOn) {
				throw new ConflictException(
					`This asset was already destroyed on ${destroyedOn}. Edit that event instead of logging another.`,
				);
			}
			const later = await this.pool.query(
				`SELECT se.title, t.name AS "eventType", se.start_date AS "startDate"
         FROM asset_service_events se
         JOIN asset_service_event_types t ON t.id = se.event_type_id
         WHERE se.asset_id = $1 AND se.id <> $2
           AND (se.start_date > $3::date OR se.end_date > $3::date)
         ORDER BY se.start_date LIMIT 1`,
				[assetId, excludeEventId ?? -1, start],
			);
			if (later.rows.length > 0) {
				const row = later.rows[0];
				throw new ConflictException(
					`Can't log destruction on ${start}: "${row.title ?? row.eventType}" (${row.startDate}) runs past that day. Move or remove it first.`,
				);
			}
			return;
		}

		if (!destroyedOn) return;
		if (start > destroyedOn || (end && end > destroyedOn)) {
			throw new ConflictException(
				`This asset was destroyed on ${destroyedOn}, so nothing can be logged after that date.`,
			);
		}
		if (!end) {
			throw new ConflictException(
				`This asset was destroyed on ${destroyedOn}, so an event can't still be open. Give it an end date on or before then.`,
			);
		}
	}

	// One open flag per asset (also a partial unique index in the database):
	// a second would only be noise -- edit or resolve the existing one.
	private async assertNoOpenFlag(
		assetId: number,
		excludeEventId?: number,
	): Promise<void> {
		const open = await this.pool.query(
			`SELECT se.title FROM asset_service_events se
							JOIN asset_service_event_types t ON t.id = se.event_type_id
							WHERE se.asset_id = $1 AND t.name = $2 AND se.end_date IS NULL
									AND se.id <> $3
							LIMIT 1`,
			[assetId, FLAG_EVENT_TYPE, excludeEventId ?? -1],
		);
		if (open.rows.length > 0) {
			throw new ConflictException(
				`This asset is already flagged servicing required${open.rows[0].title ? ` ("${open.rows[0].title}")` : ""}. Edit that one, or resolve it first.`,
			);
		}
	}

	// Every OPEN "servicing required" flag on an asset still in the fleet: the
	// home page's list, and what the detail pages and tables show as a chip.
	// Decommissioned assets are left out -- nothing needs fixing on those.
	async listServicingRequired(): Promise<ServicingRequired[]> {
		const result = await this.pool.query(
			`SELECT se.id AS "eventId", a.id AS "assetId", at.name AS "assetType",
														COALESCE(agd.glider_name, aed.name) AS "assetName",
														a.serial_number AS "serialNumber",
														se.title, se.description AS details,
														se.start_date AS "startDate"
							FROM asset_service_events se
							JOIN asset_service_event_types t
									ON t.id = se.event_type_id AND t.name = $1
							JOIN assets a ON a.id = se.asset_id
							JOIN asset_types at ON at.id = a.asset_type_id
							LEFT JOIN asset_glider_details agd ON agd.asset_id = a.id
							LEFT JOIN asset_equipment_details aed ON aed.asset_id = a.id
							WHERE se.end_date IS NULL AND a.decommissioned_date IS NULL
							ORDER BY se.start_date, se.id`,
			[FLAG_EVENT_TYPE],
		);
		return result.rows;
	}

	// The repair is done: the flag comes off. This only sets the event's end
	// date (and optionally appends what was done to its description) -- the
	// event stays on the timeline as a closed span, which is the point.
	async resolveServicingRequired(
		assetId: number,
		eventId: number,
		dto: ResolveServicingRequiredDto,
		userId: number,
	): Promise<void> {
		const found = await this.pool.query(
			`SELECT se.start_date AS "startDate", se.end_date AS "endDate",
														CURRENT_DATE::text AS today
							FROM asset_service_events se
							JOIN asset_service_event_types t ON t.id = se.event_type_id
							WHERE se.id = $1 AND se.asset_id = $2 AND t.name = $3`,
			[eventId, assetId, FLAG_EVENT_TYPE],
		);
		if (found.rows.length === 0) {
			throw new NotFoundException(
				`Servicing-required flag ${eventId} not found for asset ${assetId}.`,
			);
		}
		const { startDate, endDate, today } = found.rows[0];
		if (endDate) {
			throw new ConflictException(`That flag was already resolved on ${endDate}.`);
		}
		const date = dto.date?.slice(0, 10) ?? today;
		if (date < startDate) {
			throw new BadRequestException(
				`It can't be resolved before it was raised (${startDate}).`,
			);
		}
		if (date > today) {
			throw new BadRequestException("The resolved date can't be in the future.");
		}
		const note = dto.note?.trim() || null;
		await this.pool.query(
			`UPDATE asset_service_events
									SET end_date = $2,
													description = CASE WHEN $3::text IS NULL THEN description
																																ELSE COALESCE(description || E'\n\n', '') || 'Resolved: ' || $3 END,
													changed_by = $4
							WHERE id = $1`,
			[eventId, date, note, userId],
		);
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
		await this.assertConsistentWithDestruction(assetId, dto);
		const terminal = TERMINAL_EVENT_TYPES.has(dto.eventType);
		// A terminal event (destroyed) is allowed even while another event
		// is open -- it closes that one below. Everything else obeys the
		// one-open-event-per-asset rule.
		if (!terminal && dto.eventType !== FLAG_EVENT_TYPE) {
			await this.assertNoOpenEvent(assetId, dto.startDate);
		}
		if (dto.eventType === FLAG_EVENT_TYPE && !dto.endDate) {
			await this.assertNoOpenFlag(assetId);
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

			if (dto.closeMissionId != null) {
				await this.closeMissionTx(client, assetId, dto, userId);
			}

			// An open "servicing required" flag means do not deploy: take back
			// "cleared to deploy" on any open build this asset is part of (as the
			// glider, or as a component), as a build edit would.
			if (dto.eventType === FLAG_EVENT_TYPE && !dto.endDate) {
				await withdrawClearancesForAssetTx(
					client,
					assetId,
					userId,
					"Servicing required raised -- clearance withdrawn automatically",
				);
			}

			// Components chosen to go down with a destruction. Only a destroyed
			// event can carry them, and the marker in the status note ties them to
			// THIS event so deleting it can bring them back.
			if (dto.childAssetIds?.length) {
				if (!terminal) {
					throw new BadRequestException(
						"Only a destroyed event can take components down with it.",
					);
				}
				const named = await client.query(
					"SELECT glider_name FROM asset_glider_details WHERE asset_id = $1",
					[assetId],
				);
				const name = named.rows[0]?.glider_name ?? `asset ${assetId}`;
				await retireComponentsTx(client, {
					gliderAssetId: assetId,
					childAssetIds: dto.childAssetIds,
					date: dto.startDate.slice(0, 10),
					reason: dto.eventType,
					statusName: "destroyed",
					notes: `Destroyed with ${name} [event ${eventId}]`,
					strict: true,
					userId,
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

	// A mission's status is a STORED field (the glider's state is derived), so
	// a glider destroyed or lost mid-mission would otherwise leave that mission
	// "active" -- on the home page, blocking the workshop -- until someone
	// remembered to close it. This closes it in the same transaction as the
	// event, so the two can't disagree:
	//   destroyed -> status `killed in action`, and (if asked) retrieval date
	//                = the event date (destroyed during recovery);
	//   missing   -> status `missing in action`; never touches the dates (it
	//                wasn't retrieved).
	// Only an OPEN mission of THIS glider qualifies: started, no retrieval
	// date, not a workshop / scheduled one. Mirrors derived_asset_status.
	private async closeMissionTx(
		client: PoolClient,
		assetId: number,
		dto: RecordServicingEventDto,
		userId: number,
	): Promise<void> {
		if (dto.eventType !== "destroyed" && dto.eventType !== "missing") {
			throw new BadRequestException(
				"Only a destroyed or missing event can close a mission.",
			);
		}
		const found = await client.query(
			`SELECT m.deployment_date::date AS "deploymentDate",
              m.retrieval_date AS "retrievalDate", s.name AS status
       FROM missions m
       LEFT JOIN status s ON s.id = m.status_id
       WHERE m.id = $1 AND m.glider_asset_id = $2
       FOR UPDATE OF m`,
			[dto.closeMissionId, assetId],
		);
		if (found.rows.length === 0) {
			throw new BadRequestException(
				"That mission doesn't belong to this glider.",
			);
		}
		const m = found.rows[0];
		if (
			m.retrievalDate !== null ||
			m.deploymentDate === null ||
			["workshop", "scheduled"].includes(m.status ?? "")
		) {
			throw new ConflictException(
				"That mission isn't open (it hasn't started, or already has a retrieval date).",
			);
		}

		const destroyed = dto.eventType === "destroyed";
		const setEnd = destroyed && dto.closeMissionSetEndDate === true;
		const eventDate = dto.startDate.slice(0, 10);
		if (setEnd && eventDate < m.deploymentDate) {
			throw new BadRequestException(
				`The event date is before the mission started (${m.deploymentDate}), so it can't be its end date.`,
			);
		}
		const outcome = destroyed ? "killed in action" : "missing in action";
		const statusRow = await client.query(
			"SELECT id FROM status WHERE name = $1",
			[outcome],
		);
		if (statusRow.rows.length === 0) {
			throw new BadRequestException(`There is no "${outcome}" mission status.`);
		}
		await client.query(
			`UPDATE missions
         SET status_id = $2,
             retrieval_date = CASE WHEN $3::boolean THEN $4::date ELSE retrieval_date END,
             changed_by = $5, updated_at = now()
       WHERE id = $1`,
			[dto.closeMissionId, statusRow.rows[0].id, setEnd, eventDate, userId],
		);
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
		await this.assertConsistentWithDestruction(assetId, dto, eventId);

		// Only worth re-checking "no open event" when this edit would
		// leave the row open -- an edit that's setting/keeping an end
		// date can never conflict with anything.
		if (!dto.endDate && dto.eventType !== FLAG_EVENT_TYPE) {
			await this.assertNoOpenEvent(assetId, dto.startDate, eventId);
		}
		if (!dto.endDate && dto.eventType === FLAG_EVENT_TYPE) {
			await this.assertNoOpenFlag(assetId, eventId);
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
	// Removes a servicing event outright -- for one logged by mistake (use
	// updateEvent to correct one that is merely wrong). Hard delete, but not
	// silent: the audit trigger records the deleted row, credited to the
	// person deleting (changed_by is stamped first, because a DELETE audit row
	// otherwise carries the row's LAST EDITOR).
	//
	//   * Only the event types this service manages. Calibration events
	//     belong to the calibration flow; anything linked to a calibration row
	//     is refused too, since deleting it would orphan that row.
	//   * Its attachments go with it: the documents rows in the transaction,
	//     the stored files after it commits (best effort -- a leftover file is
	//     harmless, a half-deleted event is not).
	//   * A `destroyed` event stamped the glider's decommission date/reason
	//     ("destroyed", the event's date). Deleting it removes that stamp, so
	//     the glider returns to service -- unless the decommission no longer
	//     matches (edited since, or set separately), in which case it is left
	//     alone and can be returned to service by hand. Events the destruction
	//     auto-closed stay closed.
	async deleteEvent(
		assetId: number,
		eventId: number,
		userId: number,
	): Promise<{ returnedToService: boolean; componentsReturned: number }> {
		const client = await this.pool.connect();
		let fileReferences: string[] = [];
		let returnedToService = false;
		let componentsReturned = 0;
		try {
			await client.query("BEGIN");

			const found = await client.query(
				`SELECT se.start_date AS "startDate", t.name AS "eventType"
         FROM asset_service_events se
         JOIN asset_service_event_types t ON t.id = se.event_type_id
         WHERE se.id = $1 AND se.asset_id = $2 AND t.name = ANY($3)
         FOR UPDATE OF se`,
				[eventId, assetId, SERVICING_EVENT_TYPES],
			);
			if (found.rows.length === 0) {
				throw new NotFoundException(
					`Servicing event ${eventId} not found for asset ${assetId}.`,
				);
			}
			const { startDate, eventType } = found.rows[0];

			const linked = await client.query(
				`SELECT 1 FROM asset_ct_sensor_cal WHERE service_event_id = $1
         UNION ALL SELECT 1 FROM asset_do_sensor_cal WHERE service_event_id = $1
         UNION ALL SELECT 1 FROM asset_eco_sensor_cal WHERE service_event_id = $1
         LIMIT 1`,
				[eventId],
			);
			if (linked.rows.length > 0) {
				throw new ConflictException(
					"This event is linked to a calibration record, so it can't be deleted here.",
				);
			}

			await client.query(
				"UPDATE asset_service_events SET changed_by = $2 WHERE id = $1",
				[eventId, userId],
			);
			await client.query(
				"UPDATE documents SET changed_by = $2 WHERE service_event_id = $1",
				[eventId, userId],
			);
			const docs = await client.query(
				"DELETE FROM documents WHERE service_event_id = $1 RETURNING file_reference",
				[eventId],
			);
			fileReferences = docs.rows.map((r) => r.file_reference);
			await client.query("DELETE FROM asset_service_events WHERE id = $1", [
				eventId,
			]);

			if (TERMINAL_EVENT_TYPES.has(eventType)) {
				// Components this destruction took down: found by the marker its
				// status rows carry. Their rows are removed (restoring whatever
				// status they had before) and the decommission it applied is
				// cleared where it still matches. Credited to the deleter, as for
				// the event itself.
				const marker = `%[event ${eventId}]`;
				const kids = await client.query(
					"SELECT DISTINCT asset_id FROM asset_status_history WHERE notes LIKE $1",
					[marker],
				);
				if (kids.rows.length > 0) {
					const kidIds = kids.rows.map((r) => r.asset_id);
					await client.query(
						"UPDATE asset_status_history SET changed_by = $2 WHERE notes LIKE $1",
						[marker, userId],
					);
					await client.query(
						"DELETE FROM asset_status_history WHERE notes LIKE $1",
						[marker],
					);
					const back = await client.query(
						`UPDATE assets
															SET decommissioned_date = NULL, decommission_reason = NULL,
																			updated_at = now(), changed_by = $3
													WHERE id = ANY($1) AND decommission_reason = $4
															AND decommissioned_date = $2::date`,
						[kidIds, startDate, userId, eventType],
					);
					componentsReturned = back.rowCount ?? 0;
				}
				const cleared = await client.query(
					`UPDATE assets
             SET decommissioned_date = NULL, decommission_reason = NULL,
                 updated_at = now(), changed_by = $3
           WHERE id = $1 AND decommission_reason = $4
             AND decommissioned_date = $2::date`,
					[assetId, startDate, userId, eventType],
				);
				returnedToService = (cleared.rowCount ?? 0) > 0;
			}

			await client.query("COMMIT");
		} catch (err) {
			await client.query("ROLLBACK");
			throw err;
		} finally {
			client.release();
		}

		for (const ref of fileReferences) {
			try {
				await this.documents.removeFile(ref);
			} catch {
				// The row is gone; an orphaned file on disk is harmless.
			}
		}
		return { returnedToService, componentsReturned };
	}
}
