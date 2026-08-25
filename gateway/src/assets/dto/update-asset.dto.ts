import { PartialType } from "@nestjs/mapped-types";
import { CreateAssetDto } from "./create-asset.dto";

// assetTypeId rides along as optional (PartialType makes every
// CreateAssetDto field optional) but AssetsService.update never reads
// it -- changing what type an asset is after creation is a structural
// change this form doesn't support, same as gliders not letting
// glider-vs-non-glider change through UpdateGliderDto.
export class UpdateAssetDto extends PartialType(CreateAssetDto) {}
