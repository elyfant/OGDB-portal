import { PartialType } from "@nestjs/mapped-types";
import { CreateRmaDto } from "./create-rma.dto";

// Full-replace PATCH, same convention as UpdateMissionDto -- every field
// is optional so a partial edit (e.g. just fixing a typo'd rma_number)
// doesn't require resubmitting everything, but RmasService.update reads
// each with COALESCE against the current row rather than clearing on
// omission.
export class UpdateRmaDto extends PartialType(CreateRmaDto) {}
