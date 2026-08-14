"use client";

import { formatDate } from "@/lib/format";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import type { DatasetProcessingStageDetail } from "@ogdb/types";
import { Fragment, useState } from "react";

const STAGE_LABEL: Record<string, string> = {
	raw: "Raw data archived",
	L0: "L0",
	L1: "L1 (timeseries)",
	L2: "L2 (gridded)",
};

function Tick({ done }: { done: boolean }) {
	return done ? (
		<CheckCircleIcon fontSize="small" color="success" />
	) : (
		<CancelIcon fontSize="small" color="error" />
	);
}

function NotApplicable() {
	return (
		<Typography variant="caption" color="text.disabled">
			n/a
		</Typography>
	);
}

function Pending() {
	return <Typography color="text.secondary">—</Typography>;
}

// version_url is just a link — no separate version-label column in the
// schema — so derive something short and readable from the URL's last
// path segment (works for typical GitHub/GitLab release URLs) rather
// than showing the full URL or a meaningless generic word.
function versionLabel(url: string): string {
	try {
		const segments = new URL(url).pathname.split("/").filter(Boolean);
		return segments.at(-1) || url;
	} catch {
		return url;
	}
}

function VersionLink({ url, prefix }: { url: string | null; prefix?: string }) {
	if (!url) return <Pending />;
	return (
		<Link href={url} target="_blank" rel="noreferrer" sx={{ fontSize: 13 }}>
			{prefix ? `${prefix}: ` : ""}
			{versionLabel(url)}{" "}
			<OpenInNewIcon sx={{ fontSize: 12, verticalAlign: -1 }} />
		</Link>
	);
}

function DownloadIndicator({ available }: { available: boolean }) {
	return (
		<FileDownloadIcon
			fontSize="small"
			sx={{ color: available ? "primary.main" : "text.disabled" }}
		/>
	);
}

function QcDetailRow({
	qc,
}: { qc: NonNullable<DatasetProcessingStageDetail["qc"]> }) {
	return (
		<TableRow>
			<TableCell colSpan={10} sx={{ py: 0, borderBottom: "none" }}>
				<Collapse in>
					<Box sx={{ py: 2, pl: 4, bgcolor: "action.hover" }}>
						<Box
							sx={{
								display: "grid",
								gridTemplateColumns: "repeat(3, 1fr)",
								gap: 1,
								mb: 1.5,
								fontSize: 13,
							}}
						>
							<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
								<Tick done={qc.removingErroneousData} /> Removing erroneous data
							</Box>
							<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
								<Tick done={qc.offsetCorrection} /> Offset correction (ship CTD)
							</Box>
							<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
								<Tick done={qc.despikingFiltering} /> Despiking / filtering
							</Box>
						</Box>
						<Box
							sx={{ display: "flex", gap: 3, flexWrap: "wrap", fontSize: 13 }}
						>
							<Typography variant="body2" color="text.secondary">
								QC package: {qc.package ?? "—"}
							</Typography>
							<VersionLink url={qc.versionUrl} prefix="QC version" />
							<Typography variant="body2" color="text.disabled">
								QC occurred at: not tracked yet
							</Typography>
							<Typography variant="body2" color="text.disabled">
								QC by: not tracked yet
							</Typography>
						</Box>
					</Box>
				</Collapse>
			</TableCell>
		</TableRow>
	);
}

export default function ProcessingStatusTable({
	stages,
}: {
	stages: DatasetProcessingStageDetail[];
}) {
	const [expanded, setExpanded] = useState<Set<string>>(new Set());

	function toggle(stage: string) {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(stage)) next.delete(stage);
			else next.add(stage);
			return next;
		});
	}

	return (
		<TableContainer component={Paper}>
			<Table size="small" sx={{ minWidth: 960 }}>
				<TableHead>
					<TableRow>
						<TableCell>Stage</TableCell>
						<TableCell>Status</TableCell>
						<TableCell>Who</TableCell>
						<TableCell>Occurred at</TableCell>
						<TableCell>Package</TableCell>
						<TableCell>Version</TableCell>
						<TableCell>Manual QC</TableCell>
						<TableCell>OG1</TableCell>
						<TableCell>Internal download</TableCell>
						<TableCell>Internal download OG1</TableCell>
					</TableRow>
				</TableHead>
				<TableBody>
					{stages.map((s) => (
						<Fragment key={s.stage}>
							<TableRow hover>
								<TableCell>{STAGE_LABEL[s.stage] ?? s.stage}</TableCell>
								<TableCell>
									<Tick done={s.status} />
								</TableCell>
								<TableCell>{s.who ?? <Pending />}</TableCell>
								<TableCell>
									{s.occurredAt ? formatDate(s.occurredAt) : <Pending />}
								</TableCell>
								<TableCell>
									{s.applicable ? (
										(s.package ?? <Pending />)
									) : (
										<NotApplicable />
									)}
								</TableCell>
								<TableCell>
									{s.applicable ? (
										<VersionLink url={s.versionUrl} />
									) : (
										<NotApplicable />
									)}
								</TableCell>
								<TableCell>
									{!s.applicable ? (
										<NotApplicable />
									) : s.qc ? (
										<Chip
											label="Applied"
											size="small"
											onClick={() => toggle(s.stage)}
											deleteIcon={
												expanded.has(s.stage) ? (
													<KeyboardArrowUpIcon />
												) : (
													<KeyboardArrowDownIcon />
												)
											}
											onDelete={() => toggle(s.stage)}
										/>
									) : (
										<Pending />
									)}
								</TableCell>
								<TableCell>
									{s.applicable ? (
										s.isOg1 === null ? (
											<Pending />
										) : (
											<Tick done={s.isOg1} />
										)
									) : (
										<NotApplicable />
									)}
								</TableCell>
								<TableCell>
									{s.applicable ? (
										<DownloadIndicator available={s.hasInternalDownload} />
									) : (
										<NotApplicable />
									)}
								</TableCell>
								<TableCell>
									{s.applicable ? (
										<DownloadIndicator available={s.hasInternalDownloadOg1} />
									) : (
										<NotApplicable />
									)}
								</TableCell>
							</TableRow>
							{s.qc && expanded.has(s.stage) && <QcDetailRow qc={s.qc} />}
						</Fragment>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
