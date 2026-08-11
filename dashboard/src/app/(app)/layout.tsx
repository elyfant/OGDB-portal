import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AppLayout({
	children,
}: {
	children: ReactNode;
}) {
	const user = await getCurrentUser();
	if (!user) {
		redirect("/login");
	}

	return <AppShell user={user}>{children}</AppShell>;
}
