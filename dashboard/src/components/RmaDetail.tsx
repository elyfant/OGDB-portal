"use client";

import LinkRmaAssetDialog from "@/components/LinkRmaAssetDialog";
import RmaAssetsTable from "@/components/RmaAssetsTable";
import RmaEventControls, {
	type RmaEventControlsHandle,
} from "@/components/RmaEventControls";
import RmaEventsTimeline from "@/components/RmaEventsTimeline";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { LookupOption, RmaAsset, RmaEvent } from "@ogdb/types";
import { useRef, useState } from "react";

// Owns the interactive state for an RMA's own page: which linked-asset
// row (if any) is being edited, and a ref into RmaEventControls so the
// events timeline's row clicks can open the same add/edit dialog the
// "Add event" button uses -- same ref-handle pattern
// GliderTimelineTab/AssetServicingTimeline already use for
// ServicingEventControls.
export default function RmaDetail({
	rmaId,
	assets,
	events,
	assetTypes,
	manufacturers,
	canEdit,
}: {
	rmaId: number;
	assets: RmaAsset[];
	events: RmaEvent[];
	assetTypes: LookupOption[];
	manufacturers: LookupOption[];
	canEdit: boolean;
}) {
	const [editingAsset, setEditingAsset] = useState<RmaAsset | null>(null);
	const eventControlsRef = useRef<RmaEventControlsHandle>(null);

	return (
		<Box>
			<Box
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					mb: 1.5,
				}}
			>
				<Typography variant="h6">Linked assets</Typography>
				{canEdit && (
					<LinkRmaAssetDialog
						rmaId={rmaId}
						assetTypes={assetTypes}
						mode="link"
					/>
				)}
			</Box>
			<RmaAssetsTable
				assets={assets}
				canEdit={canEdit}
				onEditReason={setEditingAsset}
			/>
			<LinkRmaAssetDialog
				rmaId={rmaId}
				assetTypes={assetTypes}
				mode="edit"
				row={editingAsset}
				onClose={() => setEditingAsset(null)}
			/>

			<Typography variant="h6" sx={{ mt: 4, mb: 1.5 }}>
				History
			</Typography>
			<RmaEventControls
				ref={eventControlsRef}
				rmaId={rmaId}
				manufacturers={manufacturers}
				canEdit={canEdit}
			/>
			<RmaEventsTimeline
				events={events}
				canEdit={canEdit}
				onEditEvent={(e) => eventControlsRef.current?.openForEdit(e)}
			/>
		</Box>
	);
}
