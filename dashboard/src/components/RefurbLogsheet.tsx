"use client";

import CheckIcon from "@mui/icons-material/Check";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { RefurbSectionKey, RefurbSectionState } from "@ogdb/types";
import { type ReactNode, useState } from "react";

export interface LogsheetSectionDef {
	key: RefurbSectionKey;
	number: number;
	title: string;
	// The parts inside it, in a few words.
	subtitle: string;
	// "Parallel": can be done alongside the hardware work. "Optional": never
	// blocks clearing.
	badge?: "Parallel" | "Optional";
	state: RefurbSectionState;
	content: ReactNode;
}

type Status = "done" | "progress" | "todo";

const statusOf = (s: RefurbSectionState): Status =>
	s.complete ? "done" : s.started ? "progress" : "todo";

const STATUS_LABEL: Record<Status, string> = {
	done: "Done",
	progress: "In progress",
	todo: "Not started",
};

const STATUS_COLOR: Record<Status, string> = {
	done: "success.main",
	progress: "warning.main",
	todo: "action.disabled",
};

const anchor = (n: number) => `refurb-section-${n}`;

// The refurbishment logsheet as numbered, collapsible section cards under a
// progress bar. Section content stays mounted when a card is collapsed, so
// something half typed is not lost by closing it.
export default function RefurbLogsheet({
	sections,
}: {
	sections: LogsheetSectionDef[];
}) {
	const required = sections.filter((s) => s.state.required);
	const done = required.filter((s) => s.state.complete).length;
	const remaining = required.length - done;

	// Start on the first required section that is not done: "what's next".
	const [open, setOpen] = useState<Set<RefurbSectionKey>>(() => {
		const next = required.find((s) => !s.state.complete);
		return new Set(next ? [next.key] : []);
	});

	const toggle = (key: RefurbSectionKey, expanded: boolean) =>
		setOpen((prev) => {
			const next = new Set(prev);
			if (expanded) next.add(key);
			else next.delete(key);
			return next;
		});

	const jumpTo = (s: LogsheetSectionDef) => {
		setOpen((prev) => new Set(prev).add(s.key));
		// After the card has opened, bring it to the top.
		requestAnimationFrame(() =>
			document
				.getElementById(anchor(s.number))
				?.scrollIntoView({ behavior: "smooth", block: "start" }),
		);
	};

	return (
		<Box>
			<Paper
				variant="outlined"
				sx={{
					position: "sticky",
					top: 0,
					zIndex: 2,
					p: 2,
					mb: 2,
					bgcolor: "background.paper",
				}}
			>
				<Stack
					direction="row"
					sx={{
						alignItems: "baseline",
						justifyContent: "space-between",
						flexWrap: "wrap",
						gap: 1,
					}}
				>
					<Typography sx={{ fontWeight: 600 }}>
						{done} of {required.length} required sections done
					</Typography>
					<Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
						<Chip
							size="small"
							color={remaining === 0 ? "success" : "warning"}
							label={
								remaining === 0
									? "Ready to clear for deployment"
									: `${remaining} to go before it can be cleared`
							}
						/>
						<Button
							size="small"
							onClick={() => setOpen(new Set(sections.map((s) => s.key)))}
						>
							Expand all
						</Button>
						<Button size="small" onClick={() => setOpen(new Set())}>
							Collapse all
						</Button>
					</Stack>
				</Stack>

				<Stack direction="row" spacing={0.5} sx={{ mt: 1.5 }}>
					{sections.map((s) => {
						const status = statusOf(s.state);
						const optional = !s.state.required;
						return (
							<ButtonBase
								key={s.key}
								onClick={() => jumpTo(s)}
								aria-label={`Go to section ${s.number}, ${s.title}: ${STATUS_LABEL[status]}${optional ? " (optional)" : ""}`}
								title={`${s.number}. ${s.title} — ${STATUS_LABEL[status]}`}
								sx={{
									flex: 1,
									display: "block",
									borderRadius: 0.5,
									"&:focus-visible": {
										outline: "2px solid",
										outlineColor: "primary.main",
									},
								}}
							>
								<Box
									sx={{
										height: 8,
										borderRadius: 0.5,
										bgcolor:
											optional && status === "todo"
												? "transparent"
												: STATUS_COLOR[status],
										border:
											optional && status === "todo" ? "1px dashed" : "none",
										borderColor: "text.disabled",
									}}
								/>
								<Typography
									variant="caption"
									color="text.secondary"
									sx={{
										display: "block",
										textAlign: "center",
										mt: 0.25,
										fontSize: 11,
									}}
								>
									{s.number}
								</Typography>
							</ButtonBase>
						);
					})}
				</Stack>
				<Stack direction="row" spacing={2} sx={{ mt: 1, flexWrap: "wrap" }}>
					{(["done", "progress", "todo"] as const).map((st) => (
						<Stack
							key={st}
							direction="row"
							spacing={0.5}
							sx={{ alignItems: "center" }}
						>
							<Box
								sx={{
									width: 10,
									height: 10,
									borderRadius: 0.5,
									bgcolor: STATUS_COLOR[st],
								}}
							/>
							<Typography variant="caption" color="text.secondary">
								{STATUS_LABEL[st]}
							</Typography>
						</Stack>
					))}
					<Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
						<Box
							sx={{
								width: 10,
								height: 10,
								borderRadius: 0.5,
								border: "1px dashed",
								borderColor: "text.disabled",
							}}
						/>
						<Typography variant="caption" color="text.secondary">
							Optional
						</Typography>
					</Stack>
				</Stack>
			</Paper>

			<Stack spacing={1}>
				{sections.map((s) => {
					const status = statusOf(s.state);
					const expanded = open.has(s.key);
					return (
						<Accordion
							key={s.key}
							id={anchor(s.number)}
							expanded={expanded}
							onChange={(_, e) => toggle(s.key, e)}
							disableGutters
							variant="outlined"
							sx={{
								scrollMarginTop: 160,
								borderRadius: 2,
								"&:before": { display: "none" },
								borderColor: expanded ? "primary.main" : "divider",
								borderStyle:
									s.badge === "Optional" && !expanded ? "dashed" : "solid",
							}}
						>
							<AccordionSummary
								expandIcon={<ExpandMoreIcon />}
								sx={{ bgcolor: expanded ? "action.hover" : "transparent" }}
							>
								<Stack
									direction="row"
									spacing={1.5}
									sx={{ alignItems: "center", width: "100%", pr: 1 }}
								>
									<Box
										sx={{
											width: 30,
											height: 30,
											borderRadius: "50%",
											flex: "none",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											fontSize: 14,
											fontWeight: 600,
											bgcolor:
												status === "todo"
													? "action.selected"
													: STATUS_COLOR[status],
											color:
												status === "todo" ? "text.secondary" : "common.white",
										}}
									>
										{status === "done" ? (
											<CheckIcon sx={{ fontSize: 18 }} />
										) : (
											s.number
										)}
									</Box>
									<Box sx={{ flex: 1, minWidth: 0 }}>
										<Typography sx={{ fontWeight: 600 }}>
											{s.number}. {s.title}
										</Typography>
										<Typography
											variant="caption"
											color="text.secondary"
											noWrap
											sx={{ display: "block" }}
										>
											{s.subtitle}
										</Typography>
									</Box>
									{s.badge && (
										<Chip size="small" variant="outlined" label={s.badge} />
									)}
									<Typography
										variant="body2"
										sx={{
											color:
												status === "done" ? "success.main" : "text.secondary",
											whiteSpace: "nowrap",
										}}
									>
										{STATUS_LABEL[status]}
									</Typography>
								</Stack>
							</AccordionSummary>
							<AccordionDetails sx={{ pt: 2 }}>
								{status === "progress" && s.state.blockers.length > 0 && (
									<Alert severity="info" sx={{ mb: 2 }}>
										Still to do:
										<Box component="ul" sx={{ m: 0, pl: 2.5 }}>
											{s.state.blockers.map((b) => (
												<li key={b}>{b}</li>
											))}
										</Box>
									</Alert>
								)}
								{s.content}
							</AccordionDetails>
						</Accordion>
					);
				})}
			</Stack>
		</Box>
	);
}
