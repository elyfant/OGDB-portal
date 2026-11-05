import { formatAssetType } from "@/lib/format";
import { layoutSlocumG3 } from "@/lib/glider-diagram/slocum-g3";
import { PARTS } from "@/lib/glider-diagram/slocum-g3/parts.generated";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import type { GliderBuildComponent } from "@ogdb/types";
import Link from "next/link";

const PAD = 6;

// A scale drawing of the glider's current build: each assigned asset is
// drawn in its slot, linking through to that asset's page. Slots with
// nothing assigned show as dashed outlines, so a gap in the build is
// visible. Slocum G3 only, for now.
export default function GliderDiagram({
	components,
}: {
	components: GliderBuildComponent[];
}) {
	const { parts, width, height, notShown } = layoutSlocumG3(components);

	return (
		<Box>
			<Box
				component="svg"
				viewBox={`${-PAD} ${-PAD} ${width + 2 * PAD} ${height + 2 * PAD}`}
				role="img"
				aria-label="Glider build diagram"
				sx={{
					display: "block",
					// On very large screens the full-width glider is overwhelming:
					// hold it to 75% of the box (xl = 1536px and up), centred.
					width: { xs: "100%", xl: "75%" },
					mx: "auto",
					height: "auto",
					maxHeight: 320,
					color: "text.disabled",
					// Brighten the hovered part so it's clear what a click opens.
					"& a.part": { cursor: "pointer" },
					"& a.part:hover": {
						filter: "brightness(1.12) drop-shadow(0 0 4px rgba(0,0,0,0.45))",
					},
				}}
			>
				{parts.map((p) => {
					const c = p.component;
					const title = c
						? `${p.slot.label}: ${formatAssetType(c.assetType)}${
								c.model ? ` · ${c.model}` : ""
							}${c.serialNumber ? ` · SN ${c.serialNumber}` : ""}`
						: `${p.slot.label}: nothing assigned`;
					const art = (
						<g
							// The markup is generated from our own deck by
							// scripts/pptx_to_glider_parts.py -- not user input.
							// biome-ignore lint/security/noDangerouslySetInnerHtml: generated static artwork
							dangerouslySetInnerHTML={{ __html: PARTS[p.partId].svg }}
						/>
					);
					return (
						<g
							key={p.slot.key}
							transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`}
						>
							<title>{title}</title>
							{c ? (
								<Link href={`/assets/${c.assetId}`} className="part">
									{art}
								</Link>
							) : (
								<rect
									width={p.width}
									height={p.height}
									rx={4}
									fill="none"
									stroke="currentColor"
									strokeWidth={1.5}
									strokeDasharray="6 4"
								/>
							)}
						</g>
					);
				})}
			</Box>

			{notShown.length > 0 && (
				<Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.5 }}>
					<Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
						Not drawn yet:
					</Typography>
					{notShown.map((c) => (
						<Chip
							key={c.assetId}
							size="small"
							variant="outlined"
							label={
								c.position
									? `${formatAssetType(c.assetType)} (${c.position})`
									: formatAssetType(c.assetType)
							}
						/>
					))}
				</Box>
			)}
		</Box>
	);
}
