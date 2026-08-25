import type {
	DatasetProcessingStage,
	NetcdfMetadata,
} from "@ogdb/types";
import { IsIn, IsInt, IsObject, IsString, Min } from "class-validator";

// Deep shape of netcdfMetadata isn't validated here -- it's produced by
// ogdp.erddap.inspect_netcdf, not typed by hand at the call site, same
// reasoning as ApplyDatasetStagesDto leaving `stages` shallow. stage is
// the one field checked here since it drives the document_type this
// becomes (see DatasetsService.registerDocument).
export class RegisterDatasetDocumentDto {
	@IsIn(["raw", "L0", "DM", "PUB"])
	stage!: DatasetProcessingStage;

	@IsString()
	fileReference!: string;

	@IsString()
	fileHash!: string;

	@IsInt()
	@Min(0)
	fileSizeBytes!: number;

	@IsObject()
	netcdfMetadata!: NetcdfMetadata;
}
