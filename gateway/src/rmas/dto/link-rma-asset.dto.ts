import { IsInt, IsString, MaxLength } from "class-validator";

export class LinkRmaAssetDto {
	@IsInt()
	assetId!: number;

	// The reason for *this* asset specifically -- two assets on the same
	// RMA commonly have different failure reasons (e.g. one hull's aft
	// leak vs. another's fore leak), so this isn't shared at the RMA
	// header level.
	@IsString()
	@MaxLength(2000)
	reason!: string;
}
