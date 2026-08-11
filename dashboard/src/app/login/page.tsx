"use client";

import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: FormEvent) {
		event.preventDefault();
		setError(null);
		setPending(true);
		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email, password }),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => null);
				setError(data?.message ?? "Login failed.");
				return;
			}
			router.push("/");
			router.refresh();
		} finally {
			setPending(false);
		}
	}

	return (
		<Box
			sx={{
				minHeight: "100vh",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				bgcolor: "background.default",
				p: 2,
			}}
		>
			<Paper
				elevation={0}
				sx={{
					p: 4,
					width: "100%",
					maxWidth: 380,
					border: "1px solid",
					borderColor: "divider",
					borderRadius: 3,
				}}
			>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
					<Typography variant="h6" letterSpacing={2}>
						OGDB PORTAL
					</Typography>
					<Chip label="BETA" size="small" color="primary" variant="outlined" />
				</Box>
				<Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
					Sign in with your OGDB account.
				</Typography>

				<Box component="form" onSubmit={handleSubmit}>
					<TextField
						label="Email"
						type="email"
						fullWidth
						required
						autoFocus
						margin="normal"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
					/>
					<TextField
						label="Password"
						type="password"
						fullWidth
						required
						margin="normal"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
					/>
					{error && (
						<Alert severity="error" sx={{ mt: 2 }}>
							{error}
						</Alert>
					)}
					<Button
						type="submit"
						variant="contained"
						fullWidth
						size="large"
						disabled={pending}
						sx={{ mt: 3 }}
					>
						{pending ? "Signing in…" : "Sign in"}
					</Button>
				</Box>
			</Paper>
		</Box>
	);
}
