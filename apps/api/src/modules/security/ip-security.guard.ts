import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { isIP } from 'node:net';
import { GeoIpCountryService } from './geoip-country.service';
import { IpSecurityService } from './ip-security.service';

function isLoopback(ip: string) {
  const value = ip.toLowerCase().replace(/^::ffff:/, '');
  return value === '::1' || value.startsWith('127.');
}

@Injectable()
export class IpSecurityGuard implements CanActivate {
  constructor(
    private readonly geoIp: GeoIpCountryService,
    private readonly ipSecurity: IpSecurityService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ ip?: string; path?: string }>();
    if (request.path === '/health' || request.path?.startsWith('/health/') || request.path === '/api/v1/health' || request.path?.startsWith('/api/v1/health/')) {
      return true;
    }
    const ip = request.ip?.trim();
    if (!ip || !isIP(ip.replace(/^::ffff:/i, ''))) {
      if (process.env.NODE_ENV !== 'production') return true;
      throw new ForbiddenException('IP_ADDRESS_UNAVAILABLE');
    }
    await this.ipSecurity.assertIpAllowed(ip);
    if (isLoopback(ip)) return true;
    if (this.geoIp.isCountryFilteringEnabled()) {
      const country = this.geoIp.countryCode(ip.replace(/^::ffff:/i, ''));
      if (country !== 'VN') throw new ForbiddenException('VIETNAM_ONLY');
    }
    return true;
  }
}
