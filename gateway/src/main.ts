import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	// No CORS: the browser only ever talks to the dashboard, which proxies
	// authenticated calls to this gateway server-to-server.
	app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
	const port = process.env.PORT ?? 3001;
	await app.listen(port);
}

bootstrap();
