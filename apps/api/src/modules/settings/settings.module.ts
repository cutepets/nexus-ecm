import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SettingsController],
  providers: [SettingsService],
})
export class SettingsModule {}
