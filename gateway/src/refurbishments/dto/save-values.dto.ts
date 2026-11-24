import { IsObject } from "class-validator";

// A section's submitted values as one object; the service validates field by
// field (see SaveTankRunDto for why it is not decorated per field).
export class SaveValuesDto {
	@IsObject()
	values!: Record<string, unknown>;
}
