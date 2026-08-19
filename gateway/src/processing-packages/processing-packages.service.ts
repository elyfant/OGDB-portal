import {
	ConflictException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type { ProcessingPackage } from "@ogdb/types";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";
import type { CreateProcessingPackageVersionDto } from "./dto/create-processing-package-version.dto";
import type { CreateProcessingPackageDto } from "./dto/create-processing-package.dto";

function isUniqueViolation(err: unknown): boolean {
	return (
		!!err &&
		typeof err === "object" &&
		"code" in err &&
		(err as { code: string }).code === "23505"
	);
}

@Injectable()
export class ProcessingPackagesService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	// Versions come nested -- the picker always needs a package's full
	// version list at once, so one query grouped in JS beats a second
	// round trip per package for a list this small.
	async findAll(): Promise<ProcessingPackage[]> {
		const result = await this.pool.query(
			`SELECT
         pkg.id AS "packageId",
         pkg.name AS "packageName",
         v.id AS "versionId",
         v.version_label AS "versionLabel",
         v.version_url AS "versionUrl"
       FROM processing_packages pkg
       LEFT JOIN processing_package_versions v ON v.package_id = pkg.id
       ORDER BY pkg.name, v.version_label`,
		);

		const byId = new Map<number, ProcessingPackage>();
		for (const row of result.rows) {
			let pkg = byId.get(row.packageId);
			if (!pkg) {
				pkg = { id: row.packageId, name: row.packageName, versions: [] };
				byId.set(row.packageId, pkg);
			}
			if (row.versionId) {
				pkg.versions.push({
					id: row.versionId,
					versionLabel: row.versionLabel,
					versionUrl: row.versionUrl,
				});
			}
		}
		return Array.from(byId.values());
	}

	async create(dto: CreateProcessingPackageDto): Promise<ProcessingPackage> {
		try {
			const result = await this.pool.query(
				"INSERT INTO processing_packages (name) VALUES ($1) RETURNING id, name",
				[dto.name],
			);
			return { id: result.rows[0].id, name: result.rows[0].name, versions: [] };
		} catch (err) {
			if (isUniqueViolation(err)) {
				throw new ConflictException(
					`A package named "${dto.name}" already exists.`,
				);
			}
			throw err;
		}
	}

	async createVersion(
		packageId: number,
		dto: CreateProcessingPackageVersionDto,
	): Promise<{ id: number; versionLabel: string; versionUrl: string | null }> {
		const pkg = await this.pool.query(
			"SELECT id FROM processing_packages WHERE id = $1",
			[packageId],
		);
		if (pkg.rows.length === 0) {
			throw new NotFoundException(`Processing package ${packageId} not found`);
		}

		try {
			const result = await this.pool.query(
				`INSERT INTO processing_package_versions (package_id, version_label, version_url)
         VALUES ($1, $2, $3)
         RETURNING id, version_label AS "versionLabel", version_url AS "versionUrl"`,
				[packageId, dto.versionLabel, dto.versionUrl ?? null],
			);
			return result.rows[0];
		} catch (err) {
			if (isUniqueViolation(err)) {
				throw new ConflictException(
					`Version "${dto.versionLabel}" already exists for this package.`,
				);
			}
			throw err;
		}
	}
}
