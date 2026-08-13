import DetailFields from "@/components/DetailFields";
import PageBreadcrumb from "@/components/PageBreadcrumb";
import { getMission } from "@/lib/api";
import { MISSION_COLUMNS, formatMissionValue } from "@/lib/mission-columns";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";

// The name itself is the page heading — don't repeat it in the field list.
const NAME_KEYS = new Set(["missionName", "stdMissionName"]);

export default async function MissionDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const mission = await getMission(Number(id));
	if (!mission) notFound();

	const name =
		mission.stdMissionName ??
		mission.missionName ??
		`Mission ${mission.missionNumber ?? mission.id}`;

	return (
		<Box>
			<PageBreadcrumb
				catalogue="Missions"
				catalogueHref="/missions"
				current={name}
			/>
			<Typography variant="h5" sx={{ mb: 2 }}>
				Missions : {name}
			</Typography>
			<DetailFields
				fields={MISSION_COLUMNS.filter((col) => !NAME_KEYS.has(col.key)).map(
					(col) => ({
						label: col.label,
						value: formatMissionValue(mission[col.key], col),
					}),
				)}
			/>
		</Box>
	);
}
