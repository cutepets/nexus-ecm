import { assertProductionSecurityConfig } from './production-security';

const valid = {
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: 'access-secret-with-at-least-thirty-two-characters',
  JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-thirty-two-characters',
};

describe('assertProductionSecurityConfig', () => {
  it('accepts distinct strong JWT secrets in production', () => {
    expect(() => assertProductionSecurityConfig(valid)).not.toThrow();
  });

  it('rejects missing, placeholder, or identical production JWT secrets', () => {
    expect(() => assertProductionSecurityConfig({ NODE_ENV: 'production' })).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => assertProductionSecurityConfig({ ...valid, JWT_ACCESS_SECRET: 'change-me-access-secret-min-32-chars-long' })).toThrow(/non-placeholder/);
    expect(() => assertProductionSecurityConfig({ ...valid, JWT_REFRESH_SECRET: valid.JWT_ACCESS_SECRET })).toThrow(/must be different/);
  });

  it('does not constrain local development secrets', () => {
    expect(() => assertProductionSecurityConfig({ NODE_ENV: 'development' })).not.toThrow();
  });
});
