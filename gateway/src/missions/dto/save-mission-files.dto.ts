import { Transform } from "class-transformer";
import { IsArray, IsInt } from "class-validator";

// Submitted as multipart/form-data from the Add key mission file modal:
// zero or more "files" parts for new uploads, plus a "deleteIds" field
// holding a JSON-stringified array of documents.id values to remove.
// Both sides of the change ride in one request so the success banner can
// report saved and deleted files together.
export class SaveMissionFilesDto {
	@Transform(({ value }) => {
		if (value === "" || value === undefined || value === null) return [];
		return typeof value === "string" ? JSON.parse(value) : value;
	})
	@IsArray()
	@IsInt({ each: true })
	deleteIds: number[] = [];
}
