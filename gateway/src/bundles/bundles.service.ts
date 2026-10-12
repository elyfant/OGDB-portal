import { randomBytes } from "node:crypto";
import {
	access,
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import {
	BadGatewayException,
	BadRequestException,
	Inject,
	Injectable,
	NotFoundException,
} from "@nestjs/common";
import type {
	FullResolutionProfile,
	MissionBundleSummary,
	UserRole,
} from "@ogdb/types";
import { unzipSync } from "fflate";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";

// Mission data bundles (docs/mission-data-bundle.md): two Zarr stores per
// mission, built by norgliders-ERDDAP/ingest/build_bundle.py from the L2
// file live on ERDDAP and uploaded here. Stored like documents -- on a
// Docker named volume (bundles_data) mounted at BUNDLES_DIR -- as
//
//   <mission_id>/<build_id>/{public,staff}.zarr/...
//   <mission_id>/current          text file holding the current build id
//
// An upload unpacks into a new build directory and only then rewrites
// `current` (write-to-temp + rename, atomic), so a reader never sees half a
// bundle. The previous build is kept, so a page that loaded the summary
// just before an upload can finish loading its chunks; older ones are
// deleted. Bundles are derived data -- rebuildable from the L2 -- so no backup.
const BUNDLES_DIR = process.env.BUNDLES_DIR ?? "./storage/bundles";
const ERDDAP_URL = (
	process.env.ERDDAP_URL ?? "http://158.39.77.95/erddap"
).replace(/\/$/, "");

const BUNDLE_FORMAT_VERSION = 1;
const STORES = ["public.zarr", "staff.zarr"] as const;
export type StoreName = (typeof STORES)[number];
const STAFF_ROLES: UserRole[] = ["editor", "admin"];
const BUILDS_KEPT = 2;

// Limits on an uploaded zip, against a corrupt or hostile archive. A real
// bundle is ~250 files and 1-20 MB.
const MAX_ENTRIES = 20_000;
const MAX_UNPACKED_BYTES = 1024 ** 3;

// Upload time to the millisecond, so build ids sort in upload order.
const BUILD_ID_RE = /^\d{8}T\d{9}Z-[0-9a-f]{6}$/;
// Store-relative paths: zarr.json, temperature/c/0/0, stats/temperature/mean/zarr.json ...
const SEGMENT_RE = /^[A-Za-z0-9_.-]+$/;

function isSafeRelPath(rel: string): boolean {
	const parts = rel.split("/");
	return (
		parts.length > 0 &&
		parts.every((p) => SEGMENT_RE.test(p) && p !== "." && p !== "..")
	);
}

function newBuildId(): string {
	const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(".", "");
	return `${stamp}-${randomBytes(3).toString("hex")}`;
}

async function exists(p: string): Promise<boolean> {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

interface RootAttrs {
	bundle_format_version?: number;
	mission_number?: number;
	ogdb_mission_id?: number;
	built_at?: string;
	source?: { l2_file?: string };
}

@Injectable()
export class BundlesService {
	constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

	private missionDir(missionId: number): string {
		return path.join(BUNDLES_DIR, String(missionId));
	}

	async currentBuild(missionId: number): Promise<string | null> {
		try {
			const id = (
				await readFile(path.join(this.missionDir(missionId), "current"), "utf8")
			).trim();
			return BUILD_ID_RE.test(id) ? id : null;
		} catch {
			return null;
		}
	}

	private async rootAttrs(
		missionId: number,
		buildId: string,
	): Promise<RootAttrs> {
		const file = path.join(
			this.missionDir(missionId),
			buildId,
			"public.zarr",
			"zarr.json",
		);
		return JSON.parse(await readFile(file, "utf8")).attributes ?? {};
	}

	private async missionNumber(missionId: number): Promise<number> {
		const { rows } = await this.pool.query(
			"SELECT mission_number FROM missions WHERE id = $1",
			[missionId],
		);
		if (rows.length === 0) {
			throw new NotFoundException(`Mission ${missionId} not found.`);
		}
		return rows[0].mission_number;
	}

	// The L2 live on ERDDAP and the dataset's ERDDAP address -- what the
	// bundle should have been built from (§9), and where §8.3 reads from.
	private async liveL2(
		missionId: number,
	): Promise<{ file: string | null; url: string | null }> {
		const { rows } = await this.pool.query(
			`SELECT dp.erddap_l2_url AS url, l2.live_file AS file
         FROM dataset_processing dp
         LEFT JOIN current_erddap_status l2
           ON l2.dataset_processing_id = dp.id AND l2.level = 'L2'
        WHERE dp.mission_id = $1`,
			[missionId],
		);
		return { file: rows[0]?.file ?? null, url: rows[0]?.url ?? null };
	}

	async getSummary(
		missionId: number,
		role: UserRole | undefined,
	): Promise<MissionBundleSummary> {
		await this.missionNumber(missionId); // 404 for an unknown mission
		const live = await this.liveL2(missionId);
		const buildId = await this.currentBuild(missionId);
		if (!buildId) {
			return {
				available: false,
				stale: false,
				buildId: null,
				builtAt: null,
				sourceL2File: null,
				publicStoreUrl: null,
				staffStoreUrl: null,
				erddapL2Url: live.url,
			};
		}
		const attrs = await this.rootAttrs(missionId, buildId);
		const source = attrs.source?.l2_file ?? null;
		const base = `/api/missions/${missionId}/bundle/${buildId}`;
		return {
			available: true,
			// Compared by file path: a reprocessing run writes a new file, so a
			// different live path means a newer L2. (Not caught: a file
			// overwritten in place under the same name -- the bundle's
			// source.file_sha256 would, once the builder compares it.)
			stale: live.file !== null && live.file !== source,
			buildId,
			builtAt: attrs.built_at ?? null,
			sourceL2File: source,
			publicStoreUrl: `${base}/public.zarr`,
			staffStoreUrl:
				role && STAFF_ROLES.includes(role) ? `${base}/staff.zarr` : null,
			erddapL2Url: live.url,
		};
	}

	// Absolute path of one store file, for GET .../bundle/<build>/<store>/<path>.
	// Any build still on disk is served (current or the one before), so
	// URLs from a summary fetched just before an upload keep working.
	async getStoreFile(
		missionId: number,
		buildId: string,
		store: string,
		rel: string,
	): Promise<string> {
		if (
			!BUILD_ID_RE.test(buildId) ||
			!STORES.includes(store as StoreName) ||
			!isSafeRelPath(rel)
		) {
			throw new NotFoundException();
		}
		const file = path.join(this.missionDir(missionId), buildId, store, rel);
		// 404 for a missing key is what Zarr readers expect (absent chunk =
		// all fill value), not an error.
		if (!(await exists(file))) throw new NotFoundException();
		return path.resolve(file);
	}

	async upload(
		missionId: number,
		zip: Buffer | undefined,
		role: UserRole | undefined,
	): Promise<MissionBundleSummary> {
		if (!zip || zip.length === 0) {
			throw new BadRequestException('Send the bundle .zip as the "file" part.');
		}
		const number = await this.missionNumber(missionId);

		// --- unpack in memory and validate before touching the disk
		let entries: Record<string, Uint8Array>;
		let count = 0;
		let total = 0;
		try {
			entries = unzipSync(new Uint8Array(zip), {
				filter: (f) => {
					count += 1;
					total += f.originalSize;
					if (count > MAX_ENTRIES || total > MAX_UNPACKED_BYTES) {
						throw new Error("archive too large");
					}
					return !f.name.endsWith("/");
				},
			});
		} catch (e) {
			throw new BadRequestException(
				`Not a readable bundle zip: ${(e as Error).message}`,
			);
		}
		for (const name of Object.keys(entries)) {
			const [store, ...rest] = name.split("/");
			if (
				!STORES.includes(store as StoreName) ||
				!isSafeRelPath(rest.join("/"))
			) {
				throw new BadRequestException(
					`Unexpected file in bundle: "${name}" (only public.zarr/ and staff.zarr/ are allowed).`,
				);
			}
		}
		for (const store of STORES) {
			const meta = entries[`${store}/zarr.json`];
			if (!meta) {
				throw new BadRequestException(`Bundle has no ${store}/zarr.json.`);
			}
			let attrs: RootAttrs;
			try {
				attrs = JSON.parse(Buffer.from(meta).toString("utf8")).attributes ?? {};
			} catch {
				throw new BadRequestException(`${store}/zarr.json is not valid JSON.`);
			}
			if (attrs.bundle_format_version !== BUNDLE_FORMAT_VERSION) {
				throw new BadRequestException(
					`${store}: bundle_format_version ${attrs.bundle_format_version}, this portal reads ${BUNDLE_FORMAT_VERSION}.`,
				);
			}
			if (attrs.mission_number !== number) {
				throw new BadRequestException(
					`${store} is for mission number ${attrs.mission_number}, but OGDB mission ${missionId} is number ${number} -- refusing.`,
				);
			}
			if (
				attrs.ogdb_mission_id !== undefined &&
				attrs.ogdb_mission_id !== missionId
			) {
				throw new BadRequestException(
					`${store} was built for OGDB mission id ${attrs.ogdb_mission_id}, not ${missionId}.`,
				);
			}
		}

		// --- write into a fresh build directory, then switch `current`
		const dir = this.missionDir(missionId);
		const buildId = newBuildId();
		const partial = path.join(dir, `${buildId}.partial`);
		await mkdir(partial, { recursive: true });
		try {
			for (const [name, data] of Object.entries(entries)) {
				const target = path.join(partial, name);
				await mkdir(path.dirname(target), { recursive: true });
				await writeFile(target, data);
			}
			await rename(partial, path.join(dir, buildId));
		} catch (e) {
			await rm(partial, { recursive: true, force: true });
			throw e;
		}
		const tmp = path.join(dir, `current.${buildId}.tmp`);
		await writeFile(tmp, buildId);
		await rename(tmp, path.join(dir, "current"));

		await this.prune(missionId);
		return this.getSummary(missionId, role);
	}

	// Keep the newest BUILDS_KEPT builds (build ids sort by time); drop the
	// rest and any leftover .partial directory from an interrupted upload.
	private async prune(missionId: number): Promise<void> {
		const dir = this.missionDir(missionId);
		const names = await readdir(dir);
		const builds = names.filter((n) => BUILD_ID_RE.test(n)).sort();
		const keep = new Set([
			...builds.slice(-BUILDS_KEPT),
			await this.currentBuild(missionId),
		]);
		for (const n of names) {
			const stale =
				(BUILD_ID_RE.test(n) && !keep.has(n)) || n.endsWith(".partial");
			if (stale) await rm(path.join(dir, n), { recursive: true, force: true });
		}
	}

	// §8.3: one profile at full resolution, from the mission's L2 dataset on
	// ERDDAP. The bundle's own `time` array turns the profile index into a
	// time; ERDDAP is asked for that profile's rows.
	async getProfile(
		missionId: number,
		profileIndex: number,
		variables: string[],
	): Promise<FullResolutionProfile> {
		if (variables.length === 0 || variables.length > 20) {
			throw new BadRequestException(
				"Give 1-20 variables, e.g. ?variables=temperature,salinity (the ERDDAP dataset's names).",
			);
		}
		if (!variables.every((v) => /^[A-Za-z0-9_]+$/.test(v))) {
			throw new BadRequestException("Variable names: letters, digits, _ only.");
		}
		const buildId = await this.currentBuild(missionId);
		if (!buildId) throw new NotFoundException("No bundle for this mission.");
		const times = await this.readTimes(missionId, buildId);
		if (
			!Number.isInteger(profileIndex) ||
			profileIndex < 0 ||
			profileIndex >= times.length ||
			!Number.isFinite(times[profileIndex])
		) {
			throw new NotFoundException(`No profile ${profileIndex}.`);
		}
		const { url } = await this.liveL2(missionId);
		const datasetId = url?.match(/\/tabledap\/([A-Za-z0-9_]+)/)?.[1];
		if (!datasetId) {
			throw new NotFoundException("This mission has no L2 dataset on ERDDAP.");
		}

		// +-0.5 s around the profile time: ERDDAP compares times as doubles,
		// and the file's time can carry fractions of a second.
		const t = times[profileIndex];
		const iso = (s: number) => new Date(s * 1000).toISOString();
		const query = [
			["depth", ...variables].join(","),
			`time>=${iso(t - 0.5)}`,
			`time<=${iso(t + 0.5)}`,
			'orderBy("depth")',
		]
			.map(encodeURIComponent)
			.join("&");
		let res: Response;
		try {
			res = await fetch(`${ERDDAP_URL}/tabledap/${datasetId}.json?${query}`, {
				signal: AbortSignal.timeout(20_000),
			});
		} catch (e) {
			throw new BadGatewayException(
				`ERDDAP did not answer: ${(e as Error).message}`,
			);
		}
		if (!res.ok) {
			const text = await res.text();
			// ERDDAP says 404 for "no matching results", 400 for an unknown variable.
			const detail =
				text.match(/message="((?:[^"\\]|\\.)*)"/)?.[1]?.replace(/\\"/g, '"') ??
				text.slice(0, 300);
			if (res.status === 404) {
				throw new NotFoundException(
					`ERDDAP has no data for profile ${profileIndex}: ${detail}`,
				);
			}
			if (res.status === 400)
				throw new BadRequestException(`ERDDAP: ${detail}`);
			throw new BadGatewayException(`ERDDAP ${res.status}: ${detail}`);
		}
		const { table } = (await res.json()) as {
			table: {
				columnNames: string[];
				columnUnits: (string | null)[];
				rows: (number | null)[][];
			};
		};
		const col = (name: string) => table.columnNames.indexOf(name);
		const values: Record<string, (number | null)[]> = {};
		const units: Record<string, string> = {};
		for (const v of variables) {
			values[v] = table.rows.map((r) => r[col(v)] ?? null);
			units[v] = table.columnUnits[col(v)] ?? "";
		}
		return {
			profileIndex,
			time: iso(t),
			depth: table.rows.map((r) => r[col("depth")] as number),
			values,
			units,
		};
	}

	// public.zarr/time: float64 seconds since 1970, one gzip-compressed
	// chunk (as build_bundle.py writes it; checked rather than assumed).
	private async readTimes(
		missionId: number,
		buildId: string,
	): Promise<Float64Array> {
		const dir = path.join(
			this.missionDir(missionId),
			buildId,
			"public.zarr",
			"time",
		);
		const meta = JSON.parse(
			await readFile(path.join(dir, "zarr.json"), "utf8"),
		);
		const codecs: { name: string; configuration?: { endian?: string } }[] =
			meta.codecs ?? [];
		const n: number = meta.shape?.[0];
		if (
			meta.data_type !== "float64" ||
			meta.chunk_grid?.configuration?.chunk_shape?.[0] !== n ||
			codecs.map((c) => c.name).join(",") !== "bytes,gzip" ||
			codecs[0].configuration?.endian === "big"
		) {
			throw new BadGatewayException(
				"Bundle time array is not in the expected encoding.",
			);
		}
		const raw = gunzipSync(await readFile(path.join(dir, "c", "0")));
		const out = new Float64Array(n);
		for (let i = 0; i < n; i++) out[i] = raw.readDoubleLE(i * 8);
		return out;
	}
}
