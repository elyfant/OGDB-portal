import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthUser, LoginResponse, UserRole } from "@ogdb/types";
import * as bcrypt from "bcryptjs";
import type { Pool } from "pg";
import { PG_POOL } from "../db/db.constants";

export interface JwtPayload {
	sub: number;
	email: string;
	role: UserRole;
}

@Injectable()
export class AuthService {
	constructor(
		@Inject(PG_POOL) private readonly pool: Pool,
		private readonly jwt: JwtService,
	) {}

	async login(email: string, password: string): Promise<LoginResponse> {
		const result = await this.pool.query(
			"SELECT id, email, role, password_hash FROM users WHERE email = $1",
			[email],
		);
		const row = result.rows[0];
		if (!row || !row.password_hash) {
			throw new UnauthorizedException("Invalid email or password.");
		}

		const valid = await bcrypt.compare(password, row.password_hash);
		if (!valid) {
			throw new UnauthorizedException("Invalid email or password.");
		}

		const user: AuthUser = { id: row.id, email: row.email, role: row.role };
		const payload: JwtPayload = {
			sub: user.id,
			email: user.email,
			role: user.role,
		};
		const token = await this.jwt.signAsync(payload);
		return { token, user };
	}

	async findById(id: number): Promise<AuthUser | null> {
		const result = await this.pool.query(
			"SELECT id, email, role FROM users WHERE id = $1",
			[id],
		);
		return result.rows[0] ?? null;
	}
}
