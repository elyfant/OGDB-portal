import { IsObject } from "class-validator";

// The run's values arrive as one object. Field-by-field validation lives in
// TankRunsService (one table of field names, columns and kinds), not here:
// the global ValidationPipe's whitelist would silently drop every field
// that is not decorated, and 30+ near-identical decorators say less than
// one table.
export class SaveTankRunDto {
	@IsObject()
	values!: Record<string, unknown>;
}
