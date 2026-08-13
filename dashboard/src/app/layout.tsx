import ThemeRegistry from "@/theme/ThemeRegistry";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
	title: "OGDB Portal",
	description: "Ocean Glider Facility Asset & Mission Portal",
};

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>
				<ThemeRegistry>{children}</ThemeRegistry>
			</body>
		</html>
	);
}
