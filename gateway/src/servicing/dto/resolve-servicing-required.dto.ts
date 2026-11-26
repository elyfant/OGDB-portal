import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

// POST /assets/:id/servicing/:eventId/resolve -- the repair is done, so the
// "servicing required" flag comes off. The event itself stays on the timeline
// as a closed span; this only sets its end date (and optionally adds a note
// on what was done).
export class ResolveServicingRequiredDto {
	// The day it was fixed. Defaults to today; can't be before the flag was
	// raised or in the future.
	@IsOptional()
	@IsDateString()
	date?: string;

	// What was done. Appended to the event's description as "Resolved: …".
	@IsOptional()
	@IsString()
	@MaxLength(1000)
	note?: string;
}
