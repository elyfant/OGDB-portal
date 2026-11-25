import {
	Body,
	Controller,
	Get,
	Param,
	ParseIntPipe,
	Put,
} from "@nestjs/common";
import type { JwtPayload } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { Roles } from "../auth/roles.decorator";
import { SaveValuesDto } from "./dto/save-values.dto";
import { FinalPrepService } from "./final-prep.service";
import { RefurbWrites } from "./refurb-writes";

@RefurbWrites("final_prep")
@Controller("missions/:missionId/refurbishment/final-prep")
export class FinalPrepController {
	constructor(private readonly finalPrep: FinalPrepService) {}

	@Get()
	get(@Param("missionId", ParseIntPipe) missionId: number) {
		return this.finalPrep.get(missionId);
	}

	// Also saves the new tag's configuration and test readings, and changes the
	// mission's build if a different tag is chosen, all in one transaction.
	@Roles("editor", "admin")
	@Put()
	save(
		@Param("missionId", ParseIntPipe) missionId: number,
		@Body() dto: SaveValuesDto,
		@CurrentUser() user: JwtPayload,
	) {
		return this.finalPrep.save(missionId, dto.values, user.sub);
	}
}
