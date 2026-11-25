import { Transform } from "class-transformer";
import {
	IsBoolean,
	IsDateString,
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	MaxLength,
} from "class-validator";

// Mirrors RecordSensorCalibrationDto: always submitted as multipart/
// form-data (an attachment can ride along), so numeric/date fields
// arrive as form-field strings rather than JSON types -- the
// transforms below turn "" into undefined so an unfilled optional
// field doesn't fail IsDateString/IsInt.
const SERVICING_EVENT_TYPES = [
	"servicing",
	"factory_repair",
	"transit",
	"on_loan",
	"field_test",
	"missing",
	"destroyed",
	"pre_mission_servicing",
] as const;

export class RecordServicingEventDto {
	@IsIn(SERVICING_EVENT_TYPES)
	eventType!: (typeof SERVICING_EVENT_TYPES)[number];

	@IsString()
	@MaxLength(200)
	title!: string;

	@IsDateString()
	startDate!: string;

	// Null/absent means the event is still open -- see ServicingService's
	// one-open-event-per-asset rule.
	@IsOptional()
	@Transform(({ value }) => (value === "" ? undefined : value))
	@IsDateString()
	endDate?: string;

	@IsOptional()
	@Transform(({ value }) =>
		value === "" || value === undefined ? undefined : Number(value),
	)
	@IsInt()
	performedByContactId?: number;

	@IsOptional()
	@IsString()
	@MaxLength(5000)
	details?: string;

	// Logging a `destroyed` or `missing` event can close the glider's open
	// mission in the same transaction (new events only): the mission to close,
	// and -- for `destroyed` -- whether the event date also becomes its end
	// (retrieval) date. A glider destroyed on recovery was retrieved that day;
	// one lost at sea never was. See ServicingService.closeMissionTx.
	@IsOptional()
	@Transform(({ value }) =>
		value === "" || value === undefined ? undefined : Number(value),
	)
	@IsInt()
	closeMissionId?: number;

	@IsOptional()
	@Transform(({ value }) => value === true || value === "true")
	@IsBoolean()
	closeMissionSetEndDate?: boolean;
}
