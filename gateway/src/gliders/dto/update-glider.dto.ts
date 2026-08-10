import { PartialType } from "@nestjs/mapped-types";
import { CreateGliderDto } from "./create-glider.dto";

export class UpdateGliderDto extends PartialType(CreateGliderDto) {}
