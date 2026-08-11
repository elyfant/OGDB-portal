import {
	Body,
	Controller,
	Get,
	Post,
	Req,
	UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { Public } from "./public.decorator";

@Controller("auth")
export class AuthController {
	constructor(private readonly auth: AuthService) {}

	@Public()
	@Post("login")
	login(@Body() dto: LoginDto) {
		return this.auth.login(dto.email, dto.password);
	}

	@Get("me")
	async me(@Req() request: Request) {
		if (!request.user) {
			throw new UnauthorizedException();
		}
		const user = await this.auth.findById(request.user.sub);
		if (!user) {
			throw new UnauthorizedException();
		}
		return user;
	}
}
