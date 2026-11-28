import { assertProductionSecurityConfig } from './production-security';

const valid = {
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: 'access-secret-with-at-least-thirty-two-characters',
  JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-thirty-two-characters',
  POSTGRES_PASSWORD: 'postgres-production-random-secret',
  MINIO_ROOT_PASSWORD: 'minio-production-random-secret',
  SEED_ADMIN_USERNAME: 'ops-owner',
  SEED_ADMIN_PASSWORD: 'admin-seed-production-random-secret',
  FACE_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  API_URL: 'https://api.example.com',
  CORS_ORIGIN: 'https://app.example.com',
};

describe('assertProductionSecurityConfig', () => {
  it('accepts complete strong production security settings', () => {
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

  it('accepts Google Drive selected for settings-based personal OAuth', () => {
    expect(() => assertProductionSecurityConfig({
      ...valid,
      STORAGE_PROVIDER: 'GOOGLE_DRIVE',
    })).not.toThrow();
  });

  it('rejects unsupported storage provider values', () => {
    expect(() => assertProductionSecurityConfig({
      ...valid,
      STORAGE_PROVIDER: 'S3',
    })).toThrow(/STORAGE_PROVIDER must be MINIO or GOOGLE_DRIVE/);
  });
});
