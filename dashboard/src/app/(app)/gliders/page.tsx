import StatusEditor from "@/components/StatusEditor";
import { getGliders, getStatusOptions } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";

export default async function GlidersPage() {
	const [gliders, statusOptions, user] = await Promise.all([
		getGliders(),
		getStatusOptions(),
		getCurrentUser(),
	]);
	const canEdit = user?.role === "editor" || user?.role === "admin";

	return (
		<Box>
			<Typography variant="h5" sx={{ mb: 2 }}>
				Gliders
			</Typography>
			<TableContainer component={Paper}>
				<Table>
					<TableHead>
						<TableRow>
							<TableCell>Name</TableCell>
							<TableCell>WMO</TableCell>
							<TableCell>Platform</TableCell>
							<TableCell>Serial number</TableCell>
							<TableCell>Status</TableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{gliders.map((glider) => (
							<TableRow key={glider.id} hover>
								<TableCell sx={{ textTransform: "capitalize" }}>
									{glider.name}
								</TableCell>
								<TableCell>{glider.wmo ?? "—"}</TableCell>
								<TableCell sx={{ textTransform: "capitalize" }}>
									{glider.platform ?? "—"}
								</TableCell>
								<TableCell>{glider.serialNumber ?? "—"}</TableCell>
								<TableCell>
									<StatusEditor
										kind="gliders"
										id={glider.id}
										statusId={glider.statusId}
										options={statusOptions}
										disabled={!canEdit}
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>
		</Box>
	);
}
