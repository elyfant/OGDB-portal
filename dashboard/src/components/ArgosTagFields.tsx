"use client";

import {
	type ArgosTestForm,
	TAG_BATTERY_V,
	TX_LIMIT,
	TX_WARN,
	attempts,
	testProblems,
	volts,
} from "@/lib/argos-tag";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

const GRID = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
	gap: 2,
} as const;

// The readings typed in from the tag's test, replacing the old screenshot of
// the Tag Agent. They are added to the tag's test history. The tag's own
// details (type, Argos IDs, name) are managed on the asset, not here. The
// state lives in the section that uses this, so one Save covers it all.
export default function ArgosTagFields({
	test,
	onTest,
	disabled,
	serial,
	batteryLowAdvice,
}: {
	test: ArgosTestForm;
	onTest: (patch: Partial<ArgosTestForm>) => void;
	disabled: boolean;
	// The tag's serial number, for the headings.
	serial: string | null;
	// Shown with the warning when the battery voltage is outside its range.
	batteryLowAdvice?: string;
}) {
	const tp = testProblems(test);
	const v = volts(test);
	const a = attempts(test);
	const voltsOff = v !== null && (v < TAG_BATTERY_V[0] || v > TAG_BATTERY_V[1]);

	return (
		<Box>
			<Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
				Test readings{serial ? ` — ${serial}` : ""}
			</Typography>
			<Typography
				variant="caption"
				color="text.secondary"
				display="block"
				sx={{ mb: 1 }}
			>
				From the Tag Agent. Added to this tag's test history.
			</Typography>
			<Box sx={GRID}>
				<TextField
					size="small"
					label="Tagware version"
					placeholder="1.0b-7311"
					value={test.tagwareVersion}
					onChange={(e) => onTest({ tagwareVersion: e.target.value })}
					disabled={disabled}
				/>
				<TextField
					size="small"
					label="Argos Tx attempts"
					value={test.txAttempts}
					onChange={(e) => onTest({ txAttempts: e.target.value })}
					disabled={disabled}
					error={tp.txAttempts !== null}
					helperText={
						tp.txAttempts ??
						`Should be below ${TX_WARN.toLocaleString("en")}–${TX_LIMIT.toLocaleString("en")}.`
					}
					slotProps={{ htmlInput: { inputMode: "numeric" } }}
				/>
				<TextField
					size="small"
					label="Argos Tx fail count"
					value={test.txFailCount}
					onChange={(e) => onTest({ txFailCount: e.target.value })}
					disabled={disabled}
					error={tp.txFailCount !== null}
					helperText={tp.txFailCount ?? " "}
					slotProps={{ htmlInput: { inputMode: "numeric" } }}
				/>
				<TextField
					size="small"
					label="Battery voltage (V)"
					value={test.batteryVoltage}
					onChange={(e) => onTest({ batteryVoltage: e.target.value })}
					disabled={disabled}
					error={tp.batteryVoltage !== null || voltsOff}
					helperText={
						tp.batteryVoltage ??
						`Should be ${TAG_BATTERY_V[0]}–${TAG_BATTERY_V[1]} V.`
					}
					slotProps={{ htmlInput: { inputMode: "decimal" } }}
				/>
				<TextField
					select
					size="small"
					label="Transmission test"
					value={test.transmissionTestPassed}
					onChange={(e) =>
						onTest({
							transmissionTestPassed: e.target
								.value as ArgosTestForm["transmissionTestPassed"],
						})
					}
					disabled={disabled}
				>
					<MenuItem value="">—</MenuItem>
					<MenuItem value="true">Pass</MenuItem>
					<MenuItem value="false">Fail</MenuItem>
				</TextField>
			</Box>

			{voltsOff && (
				<Alert severity="warning" sx={{ mt: 1 }}>
					Tag battery is outside {TAG_BATTERY_V[0]}–{TAG_BATTERY_V[1]} V.{" "}
					{batteryLowAdvice}
				</Alert>
			)}
			{a !== null && a > TX_WARN && (
				<Alert severity={a > TX_LIMIT ? "error" : "warning"} sx={{ mt: 1 }}>
					{a > TX_LIMIT
						? `Over ${TX_LIMIT.toLocaleString("en")} transmission attempts: the tag is past its limit.`
						: `Over ${TX_WARN.toLocaleString("en")} transmission attempts: check the tag is good for another mission.`}
				</Alert>
			)}
			{test.transmissionTestPassed === "false" && (
				<Alert severity="warning" sx={{ mt: 1 }}>
					The transmission test failed.
				</Alert>
			)}
		</Box>
	);
}
