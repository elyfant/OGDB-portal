import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import type { JwtPayload } from "./auth.service";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
	constructor(
		private readonly jwt: JwtService,
		private readonly reflector: Reflector,
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (isPublic) return true;

		const request = context.switchToHttp().getRequest<Request>();
		const token = this.extractToken(request);
		if (!token) {
			throw new UnauthorizedException("Missing bearer token.");
		}

		try {
			request.user = await this.jwt.verifyAsync<JwtPayload>(token);
		} catch {
			throw new UnauthorizedException("Invalid or expired session.");
		}
		return true;
	}

	private extractToken(request: Request): string | undefined {
		const header = request.headers.authorization;
		if (!header?.startsWith("Bearer ")) return undefined;
		return header.slice("Bearer ".length);
	}
}
