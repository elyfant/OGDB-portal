import { Transform } from "class-transformer";
import {
	IsDateString,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	MaxLength,
} from "class-validator";

// Always submitted as multipart/form-data (an attachment -- an AWB, a
// commercial invoice, a repair report -- can ride along), so numeric/
// date fields arrive as form-field strings -- same "" -> undefined
// transform RecordServicingEventDto uses, so an unfilled optional field
// doesn't fail IsDateString/IsInt.
const RMA_EVENT_TYPES = [
	"opened",
	"shipped_out",
	"received_by_repairer",
	"status_update",
	"escalated_to_manufacturer",
	"shipping_issue",
	"received_by_manufacturer",
	"returned",
	"closed",
] as const;

export class RecordRmaEventDto {
	@IsIn(RMA_EVENT_TYPES)
	eventType!: (typeof RMA_EVENT_TYPES)[number];

	@IsDateString()
	eventDate!: string;

	// Who currently has the gear as of this step (a manufacturers row --
	// the repairer and the manufacturer are the same kind of entity).
	@IsOptional()
	@Transform(({ value }) =>
		value === "" || value === undefined ? undefined : Number(value),
	)
	@IsInt()
	facilityId?: number;

	// Whatever fits this step -- a tracking number, an AWB number, a
	// commercial invoice reference. Deliberately one generic field
	// rather than a column per kind of reference, same reasoning as not
	// giving every servicing event type its own dedicated columns.
	@IsOptional()
	@IsString()
	@MaxLength(100)
	referenceNumber?: string;

	@IsOptional()
	@IsString()
	@MaxLength(5000)
	notes?: string;
}
