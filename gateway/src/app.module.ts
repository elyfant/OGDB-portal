import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DbModule } from "./db/db.module";
import { GlidersModule } from "./gliders/gliders.module";

@Module({
	imports: [ConfigModule.forRoot({ isGlobal: true }), DbModule, GlidersModule],
})
export class AppModule {}
