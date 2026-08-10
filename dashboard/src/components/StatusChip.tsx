import Chip from "@mui/material/Chip";
import type { AssetStatus } from "@ogdb/types";

const STATUS_COLOR: Record<
	AssetStatus,
	"default" | "success" | "warning" | "error" | "info"
> = {
	lab: "default",
	in_house_repairs: "warning",
	factory_service: "warning",
	transit: "info",
	deployed: "success",
	on_loan: "info",
	missing: "error",
	decommissioned: "default",
};

const STATUS_LABEL: Record<AssetStatus, string> = {
	lab: "Lab",
	in_house_repairs: "In-house repairs",
	factory_service: "Factory service",
	transit: "Transit",
	deployed: "Deployed",
	on_loan: "On loan",
	missing: "Missing",
	decommissioned: "Decommissioned",
};

export default function StatusChip({
	status,
}: {
	status: AssetStatus | null;
}) {
	if (!status) {
		return <Chip label="Status not set" size="small" variant="outlined" />;
	}
	return (
		<Chip
			label={STATUS_LABEL[status]}
			color={STATUS_COLOR[status]}
			size="small"
		/>
	);
}
