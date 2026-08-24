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
	raw: "Raw data archival",
	L0: "L0 dataset",
	DM: "Delayed mode dataset",
	PUB: "Published dataset",
};
// Matches DatasetEditor's OG1_CAPABLE_STAGES -- L0 is a raw-format
// conversion, not OG1-eligible.
const OG1_CAPABLE_STAGES = new Set(["DM", "PUB"]);

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

function VersionLink({
	url,
	label,
	prefix,
}: {
	url: string | null;
	label: string | null;
	prefix?: string;
}) {
	if (!label && !url) return <Pending />;
	const text = label ?? url;
	if (!url) return <>{text}</>;
	return (
		<Link href={url} target="_blank" rel="noreferrer" sx={{ fontSize: 13 }}>
			{prefix ? `${prefix}: ` : ""}
			{text}{" "}
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

function StageDetailRow({ stage }: { stage: DatasetProcessingStageDetail }) {
	return (
		<TableRow>
			<TableCell colSpan={10} sx={{ py: 0, borderBottom: "none" }}>
				<Collapse in>
					<Box sx={{ py: 2, pl: 4, bgcolor: "action.hover" }}>
						<Typography
							variant="body2"
							color="text.secondary"
							sx={{ whiteSpace: "pre-wrap", fontSize: 13 }}
						>
							{stage.processingNotes ?? "No processing notes recorded."}
						</Typography>
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
		<TableContainer component={Paper} variant="outlined">
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
										<VersionLink url={s.versionUrl} label={s.versionLabel} />
									) : (
										<NotApplicable />
									)}
								</TableCell>
								<TableCell>
									{!s.applicable ? (
										<NotApplicable />
									) : s.processingNotes ? (
										<Chip
											icon={<Tick done={Boolean(s.qcDone)} />}
											label="Notes"
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
									) : s.qcDone === null ? (
										<Pending />
									) : (
										<Tick done={s.qcDone} />
									)}
								</TableCell>
								<TableCell>
									{OG1_CAPABLE_STAGES.has(s.stage) ? (
										<Tick done={Boolean(s.isOg1)} />
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
							{s.processingNotes && expanded.has(s.stage) && (
								<StageDetailRow stage={s} />
							)}
						</Fragment>
					))}
				</TableBody>
			</Table>
		</TableContainer>
	);
}
