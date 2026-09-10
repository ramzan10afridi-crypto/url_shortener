import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ClicksModule } from './clicks/clicks.module';
import { PrismaModule } from './prisma/prisma.module';
import { UrlsModule } from './urls/urls.module';
import { RedirectController } from './redirect/redirect.controller';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ClicksModule,
    UrlsModule,
  ],
  controllers: [RedirectController, HealthController],
})
export class AppModule {}
