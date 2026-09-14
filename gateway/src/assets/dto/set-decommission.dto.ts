import {
	IsArray,
	IsDateString,
	IsInt,
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

	// Only meaningful alongside a retiring decommissionedDate (ignored on
	// return-to-service). The reviewed set of this glider's currently
	// attached components that retire WITH it -- decommissioned, same
	// date/reason, assignment left open (the open row is the useful
	// record of "this was the final build"). Anything else the live build
	// tree actually contains is the opposite: freed up instead -- not
	// decommissioned, its assignment closed as of this date so it can
	// attach to a different glider. Send `[]`, not the field omitted, to
	// mean "free up everything currently attached"; omit the field
	// entirely to skip build-tree handling altogether (e.g. a bare,
	// non-glider asset). The service filters against the target's actual
	// live build tree either way, so a stale request can't touch
	// something that isn't really attached.
	@IsOptional()
	@IsArray()
	@IsInt({ each: true })
	childAssetIds?: number[];
}
