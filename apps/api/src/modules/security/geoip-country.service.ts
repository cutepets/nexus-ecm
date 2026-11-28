import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { open } from 'maxmind';

type GeoCountry = { country?: { iso_code?: string }; registered_country?: { iso_code?: string } };
type GeoReader = { get(ip: string): GeoCountry | undefined };

@Injectable()
export class GeoIpCountryService implements OnModuleInit {
  private readonly logger = new Logger(GeoIpCountryService.name);
  private reader: GeoReader | null = null;

  async onModuleInit() {
    if (process.env.GEOIP_COUNTRY_FILTER_ENABLED !== 'true') {
      this.logger.warn('Country filtering is disabled; IP block controls remain active.');
      return;
    }

    const path = process.env.GEOIP_COUNTRY_DB_PATH?.trim();
    if (!path) {
      throw new Error('GEOIP_COUNTRY_DB_PATH is required when GEOIP_COUNTRY_FILTER_ENABLED=true');
    }
    if (!existsSync(path)) {
      throw new Error(`GeoIP country database does not exist: ${path}`);
    }
    this.reader = await open(path) as unknown as GeoReader;
  }

  countryCode(ip: string) {
    if (!this.reader) return null;
    const result = this.reader.get(ip);
    return result?.country?.iso_code ?? result?.registered_country?.iso_code ?? null;
  }

  isCountryFilteringEnabled() {
    return this.reader !== null;
  }
}
