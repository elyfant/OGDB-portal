"use client";

import { uploadBatteryModelSds } from "@/lib/api-client";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import Tooltip from "@mui/material/Tooltip";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

// The Specs box's top-right controls: a button opening the battery
// model's current safety data sheet (SDS) in a new tab, and -- for
// editors/admins -- an upload that adds a new version. A model with no
// SDS on file shows the button disabled, so it's clear the field exists.
export default function BatterySdsControls({
	modelId,
	sdsDocumentId,
	sdsFileName,
	canEdit,
}: {
	// Null when the battery has no model set -- nothing to attach an SDS to.
	modelId: number | null;
	sdsDocumentId: number | null;
	sdsFileName: string | null;
	canEdit: boolean;
}) {
	const router = useRouter();
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [banner, setBanner] = useState<{
		severity: "success" | "error";
		message: string;
	} | null>(null);

	async function handleFile(file: File | undefined) {
		if (!file || modelId === null) return;
		if (file.type !== "application/pdf") {
			setBanner({ severity: "error", message: "The file must be a PDF." });
			return;
		}
		// A new upload becomes the current SDS; the old one stays on record
		// but is no longer linked from here, so make that a deliberate step.
		if (
			sdsDocumentId !== null &&
			!window.confirm(
				"Replace the current safety data sheet? The previous one stays on record but this page will link to the new one.",
			)
		) {
			return;
		}
		setUploading(true);
		try {
			await uploadBatteryModelSds(modelId, file);
			setBanner({
				severity: "success",
				message: "Safety data sheet uploaded!",
			});
		} catch (err) {
			setBanner({
				severity: "error",
				message:
					err instanceof Error
						? err.message
						: "Failed to upload safety data sheet.",
			});
		} finally {
			setUploading(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	}

	function dismissBanner() {
		const ok = banner?.severity === "success";
		setBanner(null);
		if (ok) router.refresh();
	}

	return (
		<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
			{sdsDocumentId !== null ? (
				<Tooltip title={sdsFileName ?? ""}>
					<Button
						component="a"
						href={`/api/documents/${sdsDocumentId}/file`}
						target="_blank"
						rel="noopener"
						variant="outlined"
						size="small"
						startIcon={<DescriptionOutlinedIcon fontSize="small" />}
					>
						Safety data sheet
					</Button>
				</Tooltip>
			) : (
				<Tooltip title="No safety data sheet on file for this model">
					<span>
						<Button
							variant="outlined"
							size="small"
							disabled
							startIcon={<DescriptionOutlinedIcon fontSize="small" />}
						>
							Safety data sheet
						</Button>
					</span>
				</Tooltip>
			)}

			{canEdit && modelId !== null && (
				<>
					<input
						ref={inputRef}
						type="file"
						accept="application/pdf"
						hidden
						onChange={(e) => handleFile(e.target.files?.[0])}
					/>
					<Button
						size="small"
						disabled={uploading}
						startIcon={<UploadFileIcon fontSize="small" />}
						onClick={() => inputRef.current?.click()}
					>
						{uploading
							? "Uploading…"
							: sdsDocumentId !== null
								? "Replace"
								: "Upload"}
					</Button>
				</>
			)}

			<Snackbar
				open={banner !== null}
				onClose={dismissBanner}
				anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
			>
				<Alert
					severity={banner?.severity}
					variant="filled"
					sx={{ maxWidth: 480 }}
					action={
						<Button color="inherit" size="small" onClick={dismissBanner}>
							OK
						</Button>
					}
				>
					{banner?.message}
				</Alert>
			</Snackbar>
		</Box>
	);
}
