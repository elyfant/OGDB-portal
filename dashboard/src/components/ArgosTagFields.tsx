"use client";

import {
	type ArgosConfigForm,
	type ArgosTestForm,
	TAG_BATTERY_V,
	TX_LIMIT,
	TX_WARN,
	attempts,
	configProblems,
	testProblems,
	volts,
} from "@/lib/argos-tag";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

const GRID = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
	gap: 2,
} as const;

// The tag's details and the readings typed in from its test, replacing the old
// screenshot of the Tag Agent. The details are kept on the tag itself, so they
// only need entering once; the readings are added to the tag's test history.
// The state lives in the section that uses this, so one Save covers it all.
export default function ArgosTagFields({
	config,
	test,
	onConfig,
	onTest,
	knownTypes,
	disabled,
	serial,
	batteryLowAdvice,
}: {
	config: ArgosConfigForm;
	test: ArgosTestForm;
	onConfig: (patch: Partial<ArgosConfigForm>) => void;
	onTest: (patch: Partial<ArgosTestForm>) => void;
	knownTypes: string[];
	disabled: boolean;
	// The tag's serial number, for the headings.
	serial: string | null;
	// Shown with the warning when the battery voltage is outside its range.
	batteryLowAdvice?: string;
}) {
	const cp = configProblems(config);
	const tp = testProblems(test);
	const v = volts(test);
	const a = attempts(test);
	const voltsOff = v !== null && (v < TAG_BATTERY_V[0] || v > TAG_BATTERY_V[1]);

	return (
		<Box>
			<Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
				Tag details{serial ? ` — ${serial}` : ""}
			</Typography>
			<Typography
				variant="caption"
				color="text.secondary"
				display="block"
				sx={{ mb: 1 }}
			>
				Kept on the tag itself, so they only need entering once.
			</Typography>
			<Box sx={GRID}>
				<Autocomplete
					freeSolo
					size="small"
					options={knownTypes}
					inputValue={config.model}
					onInputChange={(_, value) => onConfig({ model: value })}
					disabled={disabled}
					renderInput={(params) => (
						<TextField {...params} label="Tag type" placeholder="SPOT6" />
					)}
				/>
				<TextField
					size="small"
					label="Argos Dec"
					value={config.argosDec}
					onChange={(e) => onConfig({ argosDec: e.target.value })}
					disabled={disabled}
					error={cp.argosDec !== null}
					helperText={cp.argosDec ?? "6 to 8 digits."}
					slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 8 } }}
				/>
				<TextField
					size="small"
					label="Argos Hex"
					value={config.argosHex}
					onChange={(e) => onConfig({ argosHex: e.target.value })}
					disabled={disabled}
					error={cp.argosHex !== null}
					helperText={cp.argosHex ?? "6 or 7 hex digits."}
					slotProps={{
						htmlInput: { maxLength: 8, style: { textTransform: "uppercase" } },
					}}
				/>
				<TextField
					size="small"
					label="Tag name"
					value={config.tagName}
					onChange={(e) => onConfig({ tagName: e.target.value })}
					disabled={disabled}
				/>
			</Box>

			<Typography variant="body2" sx={{ fontWeight: 600, mt: 2 }}>
				Test readings
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
