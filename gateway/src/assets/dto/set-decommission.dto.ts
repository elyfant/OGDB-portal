import {
	IsDateString,
	IsOptional,
	IsString,
	MaxLength,
	ValidateIf,
} from "class-validator";

// PATCH /assets/:id/decommission. `decommissionedDate: null` clears it
// (return to service); a date retires the asset as of that day. `reason`
// is free text -- the portal modal offers a starting vocabulary (end of
// life / lost at sea / destroyed / sold / transferred) but doesn't
// constrain it. See docs/design/derived-glider-status.md.
export class SetDecommissionDto {
	@ValidateIf((o) => o.decommissionedDate !== null)
	@IsDateString()
	decommissionedDate!: string | null;

	@IsOptional()
	@IsString()
	@MaxLength(500)
	reason?: string | null;
}
