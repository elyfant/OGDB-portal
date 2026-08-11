import type { JwtPayload } from "./auth.service";

declare global {
	namespace Express {
		interface Request {
			user?: JwtPayload;
		}
	}
}
