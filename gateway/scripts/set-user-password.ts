/**
 * One-off bootstrap: set (or reset) a password for an existing users row.
 * Does not create new users — email must already exist in the table.
 *
 * Usage:
 *   npm run set-password --workspace=gateway -- --email=you@uib.no --password=...
 */
import * as path from "node:path";
import * as dotenv from "dotenv";
import * as bcrypt from "bcryptjs";
import { Pool } from "pg";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

function readArg(name: string): string | undefined {
	const prefix = `--${name}=`;
	const arg = process.argv.find((a) => a.startsWith(prefix));
	return arg?.slice(prefix.length);
}

async function main() {
	const email = readArg("email");
	const password = readArg("password");

	if (!email || !password) {
		console.error(
			"Usage: npm run set-password --workspace=gateway -- --email=you@uib.no --password=...",
		);
		process.exit(1);
	}
	if (password.length < 8) {
		console.error("Password must be at least 8 characters.");
		process.exit(1);
	}

	const pool = new Pool({ connectionString: process.env.DATABASE_URL });
	try {
		const existing = await pool.query(
			"SELECT id, role FROM users WHERE email = $1",
			[email],
		);
		if (existing.rows.length === 0) {
			const all = await pool.query("SELECT email FROM users ORDER BY email");
			console.error(
				`No user with email "${email}". Existing users:\n` +
					all.rows.map((r) => `  - ${r.email}`).join("\n"),
			);
			process.exit(1);
		}

		const passwordHash = await bcrypt.hash(password, 12);
		await pool.query(
			"UPDATE users SET password_hash = $1, updated_at = now() WHERE email = $2",
			[passwordHash, email],
		);
		console.log(
			`Password set for ${email} (role: ${existing.rows[0].role}).`,
		);
	} finally {
		await pool.end();
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
