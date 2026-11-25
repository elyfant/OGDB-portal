import {
	Body,
	Controller,
	Get,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	Query,
} from "@nestjs/common";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { CreateLocationDto } from "./dto/create-location.dto";
import { UpdateLocationDto } from "./dto/update-location.dto";
import { LocationsService } from "./locations.service";

// The shared list of places an asset can be. One list for everyone: a
// location is a fact about the asset, so it has to mean the same thing to
// every user. Anyone who needs another place adds it here.
@Controller("locations")
export class LocationsController {
	constructor(private readonly locations: LocationsService) {}

	// `?includeInactive=true` for the Locations page; pick lists omit it.
	@Get()
	findAll(@Query("includeInactive") includeInactive?: string) {
		return this.locations.findAll(includeInactive === "true");
	}

	@Roles("editor", "admin")
	@Post()
	create(@Body() dto: CreateLocationDto, @CurrentUser() user: JwtPayload) {
		return this.locations.create(dto, user.sub);
	}

	@Roles("editor", "admin")
	@Patch(":id")
	update(
		@Param("id", ParseIntPipe) id: number,
		@Body() dto: UpdateLocationDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.locations.update(id, dto, user.sub);
	}
}
