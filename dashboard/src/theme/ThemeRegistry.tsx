"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import {
	type ReactNode,
	createContext,
	useContext,
	useMemo,
	useState,
} from "react";
import { getTheme } from "./theme";

interface ColorModeContextValue {
	mode: "light" | "dark";
	toggle: () => void;
}

const ColorModeContext = createContext<ColorModeContextValue>({
	mode: "light",
	toggle: () => {},
});

export function useColorMode() {
	return useContext(ColorModeContext);
}

export default function ThemeRegistry({ children }: { children: ReactNode }) {
	const [mode, setMode] = useState<"light" | "dark">("light");
	const theme = useMemo(() => getTheme(mode), [mode]);
	const value = useMemo(
		() => ({
			mode,
			toggle: () => setMode((prev) => (prev === "light" ? "dark" : "light")),
		}),
		[mode],
	);

	return (
		<AppRouterCacheProvider options={{ key: "mui" }}>
			<ColorModeContext.Provider value={value}>
				<ThemeProvider theme={theme}>
					<CssBaseline />
					{children}
				</ThemeProvider>
			</ColorModeContext.Provider>
		</AppRouterCacheProvider>
	);
}
