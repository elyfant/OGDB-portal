import {
	Controller,
	ForbiddenException,
	Get,
	Param,
	ParseIntPipe,
	Put,
	Query,
	Res,
	UploadedFile,
	UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { memoryStorage } from "multer";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { BundlesService } from "./bundles.service";

// A bundle zip is 1-20 MB today; the limit leaves room for long Slocum missions.
const MAX_BUNDLE_BYTES = 300 * 1024 * 1024;

// Mission data bundle routes (docs/mission-data-bundle.md §8), under
// /missions/:id like the rest of a mission's data. Kept out of
// MissionsController: they serve files from the bundle volume, not OGDB rows.
@Controller("missions")
export class BundlesController {
	constructor(private readonly bundles: BundlesService) {}

	// §8.1 -- is there a bundle, is it current, where are its stores.
	@Get(":id/bundle")
	getSummary(
		@Param("id", ParseIntPipe) id: number,
		@CurrentUser() user: JwtPayload,
	) {
		return this.bundles.getSummary(id, user?.role);
	}

	// §8.4 -- upload a bundle built by build_bundle.py (multipart, part "file").
	@Roles("editor", "admin")
	@Put(":id/bundle")
	@UseInterceptors(
		FileInterceptor("file", {
			storage: memoryStorage(),
			limits: { fileSize: MAX_BUNDLE_BYTES },
		}),
	)
	upload(
		@Param("id", ParseIntPipe) id: number,
		@CurrentUser() user: JwtPayload,
		@UploadedFile() file?: Express.Multer.File,
	) {
		return this.bundles.upload(id, file?.buffer, user?.role);
	}

	// §8.2 -- the store's files, as a Zarr reader (zarrita FetchStore) asks
	// for them: zarr.json, temperature/c/0/0, ... The build id is in the URL
	// (the summary hands it out), so a file at a given URL never changes:
	// the browser may cache it for good, and a new upload means new URLs.
	@Get(":id/bundle/:build/:store/*")
	async getStoreFile(
		@Param("id", ParseIntPipe) id: number,
		@Param("build") build: string,
		@Param("store") store: string,
		@Param("0") rel: string,
		@CurrentUser() user: JwtPayload,
		@Res() res: Response,
	) {
		if (store === "staff.zarr" && !["editor", "admin"].includes(user?.role)) {
			throw new ForbiddenException(
				"The staff store is for editors and admins.",
			);
		}
		const file = await this.bundles.getStoreFile(id, build, store, rel);
		res.sendFile(file, {
			cacheControl: false,
			headers: { "Cache-Control": "private, max-age=31536000, immutable" },
		});
	}

	// §8.3 -- one profile at full resolution, from ERDDAP.
	@Get(":id/profiles/:profile")
	getProfile(
		@Param("id", ParseIntPipe) id: number,
		@Param("profile", ParseIntPipe) profile: number,
		@Query("variables") variables?: string,
	) {
		const names = (variables ?? "")
			.split(",")
			.map((v) => v.trim())
			.filter(Boolean);
		return this.bundles.getProfile(id, profile, names);
	}
}
