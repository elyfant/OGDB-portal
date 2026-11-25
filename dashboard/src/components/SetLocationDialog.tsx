"use client";

import LocationDialog from "@/components/LocationDialog";
import Button from "@mui/material/Button";
import type { Location } from "@ogdb/types";
import { useState } from "react";

// "Set" / "Change" link for an asset's location, next to the Location line
// on the glider header. Entirely optional: nothing in the portal asks for
// it, and "not recorded" is a normal state. Only offered where a place can
// actually be set -- never for a deployed, missing or destroyed glider,
// whose location is fixed by its state. The form itself is LocationDialog.
export default function SetLocationDialog({
	assetId,
	assetName,
	locations,
	currentLocationId,
	hasCurrent,
}: {
	assetId: number;
	assetName: string;
	// Active places only (the page fetches the default list).
	locations: Location[];
	currentLocationId: number | null;
	// Whether a location is recorded now: "Change" vs "Set".
	hasCurrent: boolean;
}) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button
				size="small"
				onClick={() => setOpen(true)}
				sx={{ minWidth: 0, py: 0, ml: 0.5, textTransform: "none" }}
			>
				{hasCurrent ? "Change" : "Set"}
			</Button>
			<LocationDialog
				open={open}
				onClose={() => setOpen(false)}
				assetId={assetId}
				assetName={assetName}
				locations={locations}
				initialLocationId={currentLocationId}
			/>
		</>
	);
}
