import { type ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";
import type { JwtPayload } from "./auth.service";

export const CurrentUser = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): JwtPayload | undefined => {
		const request = ctx.switchToHttp().getRequest<Request>();
		return request.user;
	},
);
