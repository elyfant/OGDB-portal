import { Controller, Get, Param, ParseIntPipe } from "@nestjs/common";
import { ArgosTagsService } from "./argos-tags.service";

// Read-only: the asset page's Argos section. Writes happen where the tag is
// used (the refurbishment logsheet), in the same transaction as the rest.
@Controller("assets/:id/argos")
export class ArgosTagsController {
	constructor(private readonly argos: ArgosTagsService) {}

	@Get()
	detail(@Param("id", ParseIntPipe) id: number) {
		return this.argos.detail(id);
	}
}
