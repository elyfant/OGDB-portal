import {
	type CanActivate,
	type ExecutionContext,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "@ogdb/types";
import type { Request } from "express";
import { ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private readonly reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
			ROLES_KEY,
			[context.getHandler(), context.getClass()],
		);
		if (!requiredRoles || requiredRoles.length === 0) return true;

		const request = context.switchToHttp().getRequest<Request>();
		const role = request.user?.role;
		if (!role || !requiredRoles.includes(role)) {
			throw new ForbiddenException(
				`Requires one of these roles: ${requiredRoles.join(", ")}.`,
			);
		}
		return true;
	}
}
