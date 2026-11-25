import { IsString, MaxLength } from "class-validator";

// POST /locations. Just a name: the list is deliberately flat (no shelves,
// rooms or parents) -- see docs/design/glider-state-and-location.md.
export class CreateLocationDto {
	// Trimmed and checked for emptiness/uniqueness in LocationsService.
	@IsString()
	@MaxLength(100)
	name!: string;
}
