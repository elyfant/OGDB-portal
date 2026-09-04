import { IsString, MaxLength } from "class-validator";

export class UpdateRmaAssetReasonDto {
	@IsString()
	@MaxLength(2000)
	reason!: string;
}
