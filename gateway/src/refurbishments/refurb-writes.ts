import {
	type CallHandler,
	type CanActivate,
	ConflictException,
	type ExecutionContext,
	Inject,
	Injectable,
	Logger,
	type NestInterceptor,
	SetMetadata,
	UseGuards,
	UseInterceptors,
	applyDecorators,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RefurbSectionKey } from "@ogdb/types";
import type { Request } from "express";
import type { Pool } from "pg";
import { type Observable, from } from "rxjs";
import { mergeMap } from "rxjs/operators";
import { PG_POOL } from "../db/db.constants";

const SECTION_META = "refurb:section";

// The test-links controller serves two sections (selftest and field test), so
// which one a request touches is worked out per request.
export type RefurbSectionTag = RefurbSectionKey | "test-links";

const isRead = (method: string) =>
	method === "GET" || method === "HEAD" || method === "OPTIONS";

const missionIdOf = (req: Request): number => Number(req.params.missionId);

// Refuses every write to a logsheet that has been cleared for deployment. The
// clearance is the lock: nothing in the logsheet changes until it is unlocked,
// which withdraws the clearance. Reads always pass.
@Injectable()
export class RefurbWritableGuard implements CanActivate {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = context.switchToHttp().getRequest<Request>();
		if (isRead(req.method)) return true;
		const r = await this.pool.query(
			"SELECT cleared_at FROM refurbishments WHERE mission_id = $1",
			[missionIdOf(req)],
		);
		if (r.rows[0]?.cleared_at) {
			throw new ConflictException(
				"This logsheet is cleared for deployment and locked. Unlock it to make changes.",
			);
		}
		return true;
	}
}

// Records who last saved each section and when. It runs only AFTER a write has
// succeeded (a refused or failed request leaves it alone), so "last edited by"
// means "last saved by". Per section, not per field.
@Injectable()
export class SectionEditsInterceptor implements NestInterceptor {
	private readonly log = new Logger(SectionEditsInterceptor.name);

	constructor(
		@Inject(PG_POOL) private readonly pool: Pool,
		private readonly reflector: Reflector,
	) {}

	async intercept(
		context: ExecutionContext,
		next: CallHandler,
	): Promise<Observable<unknown>> {
		const req = context.switchToHttp().getRequest<Request>();
		const tag = this.reflector.getAllAndOverride<RefurbSectionTag | undefined>(
			SECTION_META,
			[context.getHandler(), context.getClass()],
		);
		if (isRead(req.method) || !tag) return next.handle();

		const missionId = missionIdOf(req);
		// Work the section out BEFORE the handler runs: deleting a link removes
		// the row that says which test it belonged to.
		const section = tag === "test-links" ? await this.testSection(req) : tag;
		const userId = req.user?.sub ?? null;

		return next
			.handle()
			.pipe(
				mergeMap((result) =>
					from(this.touch(missionId, section, userId).then(() => result)),
				),
			);
	}

	private async testSection(req: Request): Promise<RefurbSectionKey> {
		const kind = req.params.kind;
		if (kind === "selftest") return "selftest";
		if (kind === "field-test") return "field_test";
		// DELETE links/:linkId
		const linkId = Number(req.params.linkId);
		if (Number.isInteger(linkId)) {
			const r = await this.pool.query(
				"SELECT kind FROM refurb_test_links WHERE id = $1",
				[linkId],
			);
			if (r.rows[0]?.kind === "field_test") return "field_test";
		}
		return "selftest";
	}

	private async touch(
		missionId: number,
		section: RefurbSectionKey,
		userId: number | null,
	): Promise<void> {
		try {
			await this.pool.query(
				`INSERT INTO refurb_section_edits (refurbishment_id, section, edited_by)
         SELECT r.id, $2, $3 FROM refurbishments r WHERE r.mission_id = $1
         ON CONFLICT (refurbishment_id, section) DO UPDATE SET
           edited_by = EXCLUDED.edited_by, edited_at = now()`,
				[missionId, section, userId],
			);
		} catch (err) {
			// The save itself has already committed. Failing the request now
			// would tell the tech it did not save when it did.
			this.log.error(
				`Could not record the edit of ${section} on mission ${missionId}: ${(err as Error).message}`,
			);
		}
	}
}

// One decorator for every logsheet section controller: writes are refused when
// the logsheet is locked, and a successful write records who saved the section.
export const RefurbWrites = (section: RefurbSectionTag) =>
	applyDecorators(
		SetMetadata(SECTION_META, section),
		UseGuards(RefurbWritableGuard),
		UseInterceptors(SectionEditsInterceptor),
	);
