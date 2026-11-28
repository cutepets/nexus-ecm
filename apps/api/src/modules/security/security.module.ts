import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { PrismaModule } from '../../core/prisma/prisma.module';
import { GeoIpCountryService } from './geoip-country.service';
import { IpSecurityGuard } from './ip-security.guard';
import { IpSecurityService } from './ip-security.service';
import { SecurityController } from './security.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [SecurityController],
  providers: [GeoIpCountryService, IpSecurityService, IpSecurityGuard],
  exports: [GeoIpCountryService, IpSecurityService, IpSecurityGuard],
})
export class SecurityModule {}
