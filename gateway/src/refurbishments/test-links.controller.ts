import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseIntPipe,
	Post,
	Put,
} from "@nestjs/common";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { SaveValuesDto } from "./dto/save-values.dto";
import { RefurbWrites } from "./refurb-writes";
import { TestLinksService, parseKind } from "./test-links.service";

@RefurbWrites("test-links")
@Controller("missions/:missionId/refurbishment/test-links")
export class TestLinksController {
	constructor(private readonly testLinks: TestLinksService) {}

	@Get()
	get(@Param("missionId", ParseIntPipe) missionId: number) {
		return this.testLinks.get(missionId);
	}

	// Add a link to a selftest or field test ("selftest" | "field-test").
	@Roles("editor", "admin")
	@Post(":kind/links")
	@HttpCode(201)
	addLink(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Param("kind") kind: string,
		@Body() dto: SaveValuesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.testLinks.addLink(
			missionId,
			parseKind(kind),
			dto.values,
			user.sub,
		);
	}

	@Roles("editor", "admin")
	@Delete("links/:linkId")
	removeLink(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Param("linkId", ParseIntPipe) linkId: number,
	) {
		return this.testLinks.removeLink(missionId, linkId);
	}

	// Confirm (or un-confirm) that the test has been done.
	@Roles("editor", "admin")
	@Put(":kind/confirmed")
	setConfirmed(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Param("kind") kind: string,
		@Body() dto: SaveValuesDto,
		@CurrentUser() user: JwtPayload,
	) {
		if (typeof dto.values.confirmed !== "boolean") {
			throw new BadRequestException("confirmed: expected true or false.");
		}
		return this.testLinks.setConfirmed(
			missionId,
			parseKind(kind),
			dto.values.confirmed,
			user.sub,
		);
	}
}
