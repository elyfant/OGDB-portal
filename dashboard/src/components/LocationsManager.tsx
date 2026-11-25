"use client";

import { createLocation, updateLocation } from "@/lib/api-client";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { Location } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useState } from "react";

// What the name dialog is doing: adding a new place, or renaming one.
type NameDialog = { mode: "add" } | { mode: "rename"; place: Location };

// The shared list of places (one list for everyone -- a location is a fact
// about the asset, so it has to mean the same thing to every user). Editors
// and admins add, rename and deactivate; nothing is ever deleted, because
// asset history points at a place by id.
export default function LocationsManager({
	locations,
	canEdit,
}: {
	locations: Location[];
	canEdit: boolean;
}) {
	const router = useRouter();
	const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);
	const [name, setName] = useState("");
	const [confirmDeactivate, setConfirmDeactivate] = useState<Location | null>(
		null,
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [banner, setBanner] = useState<{
		severity: "success" | "error";
		message: string;
	} | null>(null);

	function openAdd() {
		setName("");
		setError(null);
		setNameDialog({ mode: "add" });
	}

	function openRename(place: Location) {
		setName(place.name);
		setError(null);
		setNameDialog({ mode: "rename", place });
	}

	async function saveName() {
		if (!nameDialog) return;
		const trimmed = name.trim();
		if (!trimmed) {
			setError("Give the place a name.");
			return;
		}
		setSaving(true);
		setError(null);
		try {
			if (nameDialog.mode === "add") {
				await createLocation({ name: trimmed });
				setBanner({ severity: "success", message: `Added "${trimmed}".` });
			} else {
				await updateLocation(nameDialog.place.id, { name: trimmed });
				setBanner({
					severity: "success",
					message: `Renamed to "${trimmed}" everywhere it's used.`,
				});
			}
			setNameDialog(null);
			router.refresh();
		} catch (err) {
			// Shown inside the dialog so the name can be fixed in place.
			setError(err instanceof Error ? err.message : "Failed to save.");
		} finally {
			setSaving(false);
		}
	}

	async function setActive(place: Location, active: boolean) {
		setSaving(true);
		try {
			await updateLocation(place.id, { active });
			setConfirmDeactivate(null);
			setBanner({
				severity: "success",
				message: active
					? `"${place.name}" is available again.`
					: `"${place.name}" deactivated. Its history is kept.`,
			});
			router.refresh();
		} catch (err) {
			setBanner({
				severity: "error",
				message: err instanceof Error ? err.message : "Failed to update.",
			});
		} finally {
			setSaving(false);
		}
	}

	return (
		<>
			{canEdit && (
				<Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
					<Button
						variant="contained"
						size="small"
						startIcon={<AddCircleOutlineIcon />}
						onClick={openAdd}
					>
						Add place
					</Button>
				</Box>
			)}

			<TableContainer component={Paper} variant="outlined">
				<Table size="small">
					<TableHead>
						<TableRow>
							<TableCell>Place</TableCell>
							<TableCell align="right">Assets here</TableCell>
							<TableCell>Status</TableCell>
							{canEdit && <TableCell align="right">Actions</TableCell>}
						</TableRow>
					</TableHead>
					<TableBody>
						{locations.length === 0 && (
							<TableRow>
								<TableCell colSpan={canEdit ? 4 : 3}>
									<Typography color="text.secondary">No places yet.</Typography>
								</TableCell>
							</TableRow>
						)}
						{locations.map((place) => (
							<TableRow key={place.id} hover>
								<TableCell
									sx={{
										color: place.active ? "text.primary" : "text.disabled",
									}}
								>
									{place.name}
								</TableCell>
								<TableCell align="right">{place.assetCount}</TableCell>
								<TableCell>
									<Chip
										size="small"
										variant="outlined"
										label={place.active ? "Active" : "Deactivated"}
										color={place.active ? "success" : "default"}
									/>
								</TableCell>
								{canEdit && (
									<TableCell align="right">
										<Button size="small" onClick={() => openRename(place)}>
											Rename
										</Button>
										{place.active ? (
											<Button
												size="small"
												color="warning"
												onClick={() =>
													place.assetCount > 0
														? setConfirmDeactivate(place)
														: setActive(place, false)
												}
											>
												Deactivate
											</Button>
										) : (
											<Button
												size="small"
												onClick={() => setActive(place, true)}
											>
												Reactivate
											</Button>
										)}
									</TableCell>
								)}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</TableContainer>

			<Dialog
				open={nameDialog !== null}
				onClose={() => setNameDialog(null)}
				fullWidth
				maxWidth="xs"
			>
				<DialogTitle>
					{nameDialog?.mode === "rename" ? "Rename place" : "Add place"}
				</DialogTitle>
				<DialogContent>
					<Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
						{nameDialog?.mode === "rename" && (
							<Typography variant="body2" color="text.secondary">
								The new name appears everywhere this place is already used.
							</Typography>
						)}
						<TextField
							label="Name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") saveName();
							}}
							size="small"
							fullWidth
							autoFocus
							slotProps={{ htmlInput: { maxLength: 100 } }}
						/>
						{error && <Alert severity="error">{error}</Alert>}
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setNameDialog(null)} disabled={saving}>
						Cancel
					</Button>
					<Button variant="contained" onClick={saveName} disabled={saving}>
						{saving ? "Saving…" : "Save"}
					</Button>
				</DialogActions>
			</Dialog>

			<Dialog
				open={confirmDeactivate !== null}
				onClose={() => setConfirmDeactivate(null)}
				maxWidth="xs"
			>
				<DialogTitle>Deactivate "{confirmDeactivate?.name}"?</DialogTitle>
				<DialogContent>
					<Typography variant="body2">
						{confirmDeactivate?.assetCount}{" "}
						{confirmDeactivate?.assetCount === 1 ? "asset is" : "assets are"}{" "}
						currently recorded here. They keep it in their history, but it won't
						be offered when setting a location. You can reactivate it any time.
					</Typography>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setConfirmDeactivate(null)} disabled={saving}>
						Cancel
					</Button>
					<Button
						color="warning"
						variant="contained"
						disabled={saving}
						onClick={() =>
							confirmDeactivate && setActive(confirmDeactivate, false)
						}
					>
						Deactivate
					</Button>
				</DialogActions>
			</Dialog>

			<Snackbar
				open={banner !== null}
				autoHideDuration={5000}
				onClose={() => setBanner(null)}
				anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
			>
				<Alert
					severity={banner?.severity}
					variant="filled"
					sx={{ maxWidth: 480 }}
				>
					{banner?.message}
				</Alert>
			</Snackbar>
		</>
	);
}
