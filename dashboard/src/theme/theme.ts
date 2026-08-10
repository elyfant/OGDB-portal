import { createTheme } from "@mui/material/styles";

export function getTheme(mode: "light" | "dark") {
	return createTheme({
		palette: {
			mode,
			primary: { main: "#00897b" },
			background:
				mode === "dark"
					? { default: "#121212", paper: "#1a1a1a" }
					: { default: "#f5f6f8", paper: "#ffffff" },
		},
		shape: { borderRadius: 6 },
		typography: {
			fontFamily:
				'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
		},
		components: {
			MuiAppBar: {
				styleOverrides: {
					root: ({ theme }) => ({
						backgroundColor: theme.palette.background.paper,
						color: theme.palette.text.primary,
						boxShadow: "none",
						borderBottom: `1px solid ${theme.palette.divider}`,
					}),
				},
			},
			MuiDrawer: {
				styleOverrides: {
					paper: {
						backgroundColor: mode === "dark" ? "#1a1a1a" : "#ffffff",
					},
				},
			},
		},
	});
}
