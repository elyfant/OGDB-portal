import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

// PATCH /locations/:id. Rename and/or (de)activate. There is no delete:
// asset_location_history points at a location by id, so a place is
// deactivated (hidden from pick lists) and its history stays readable.
export class UpdateLocationDto {
	@IsOptional()
	@IsString()
	@MaxLength(100)
	name?: string;

	@IsOptional()
	@IsBoolean()
	active?: boolean;
}
