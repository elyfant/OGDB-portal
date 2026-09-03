"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import type { AssetStatusOption } from "@ogdb/types";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setStatus } from "../lib/api-client";
import { STATUS_COLOR, STATUS_LABEL } from "../lib/status-meta";

export default function StatusEditor({
	kind,
	id,
	statusId,
	options,
	disabled = false,
}: {
	// Gliders' status is derived, not editable -- see
	// docs/design/derived-glider-status.md. This control is for other
	// asset types only.
	kind: "assets";
	id: number;
	statusId: number | null;
	options: AssetStatusOption[];
	disabled?: boolean;
}) {
	const router = useRouter();
	const [pending, setPending] = useState(false);
	const [value, setValue] = useState<number | "">(statusId ?? "");

	async function handleChange(event: SelectChangeEvent<number | "">) {
		const nextId = Number(event.target.value);
		const previousValue = value;
		setValue(nextId);
		setPending(true);
		try {
			await setStatus(kind, id, nextId);
			router.refresh();
		} catch {
			setValue(previousValue);
		} finally {
			setPending(false);
		}
	}

	return (
		// Stops a click here from bubbling to the row's own onClick
		// (rows now navigate on a single click) -- covers both the
		// closed select's trigger and, since React bubbles portalled
		// content through the component tree rather than the DOM tree,
		// clicks on the open menu's options too.
		<Box component="span" onClick={(e) => e.stopPropagation()}>
			<Select
				size="small"
				value={value}
				onChange={handleChange}
				disabled={pending || disabled}
				displayEmpty
				variant="standard"
				disableUnderline
				renderValue={(selected) => {
					const option = options.find((o) => o.id === selected);
					if (!option) {
						return (
							<Chip label="Status not set" size="small" variant="outlined" />
						);
					}
					return (
						<Chip
							label={STATUS_LABEL[option.name]}
							color={STATUS_COLOR[option.name]}
							size="small"
						/>
					);
				}}
			>
				{options.map((option) => (
					<MenuItem key={option.id} value={option.id}>
						{STATUS_LABEL[option.name]}
					</MenuItem>
				))}
			</Select>
		</Box>
	);
}
