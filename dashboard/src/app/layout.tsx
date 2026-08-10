import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppShell from "../components/AppShell";
import ThemeRegistry from "../theme/ThemeRegistry";

export const metadata: Metadata = {
	title: "OGDB Portal",
	description: "Ocean Glider Facility asset & mission portal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				<ThemeRegistry>
					<AppShell>{children}</AppShell>
				</ThemeRegistry>
			</body>
		</html>
	);
}
