/** Validate only deployment-critical secrets before the API starts serving. */
export function assertProductionSecurityConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== 'production') return;

  const accessSecret = env.JWT_ACCESS_SECRET?.trim() ?? '';
  const refreshSecret = env.JWT_REFRESH_SECRET?.trim() ?? '';
  const isUnsafe = (value: string) =>
    value.length < 32 || /change[-_ ]?me|example|replace[-_ ]?me/i.test(value);

  if (isUnsafe(accessSecret) || isUnsafe(refreshSecret)) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must each be at least 32 non-placeholder characters in production');
  }
  if (accessSecret === refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production');
  }

  const requireStrongSecret = (name: string, minLength = 24) => {
    const value = env[name]?.trim() ?? '';
    if (value.length < minLength || /change[-_ ]?me|example|replace[-_ ]?me|password|admin123/i.test(value)) {
      throw new Error(`${name} must be at least ${minLength} non-placeholder characters in production`);
    }
  };
  requireStrongSecret('POSTGRES_PASSWORD');
  requireStrongSecret('MINIO_ROOT_PASSWORD');
  requireStrongSecret('SEED_ADMIN_PASSWORD', 14);

  const storageProvider = (env.STORAGE_PROVIDER ?? 'MINIO').trim().toUpperCase();
  if (storageProvider !== 'MINIO' && storageProvider !== 'GOOGLE_DRIVE') {
    throw new Error('STORAGE_PROVIDER must be MINIO or GOOGLE_DRIVE');
  }
  const seedUsername = env.SEED_ADMIN_USERNAME?.trim() ?? '';
  if (!/^[a-z0-9][a-z0-9._-]{1,30}[a-z0-9]$/i.test(seedUsername) || seedUsername.toLowerCase() === 'admin') {
    throw new Error('SEED_ADMIN_USERNAME must be a non-default 3-32 character username in production');
  }

  if (!/^[a-f0-9]{64}$/i.test(env.FACE_ENCRYPTION_KEY?.trim() ?? '')) {
    throw new Error('FACE_ENCRYPTION_KEY must be a 64-character hexadecimal key in production');
  }

  const apiUrl = env.API_URL?.trim() ?? '';
  try {
    const parsed = new URL(apiUrl);
    if (parsed.protocol !== 'https:' || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error();
  } catch {
    throw new Error('API_URL must be a public HTTPS origin without a path in production');
  }
  const corsOrigins = (env.CORS_ORIGIN ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!corsOrigins.length || corsOrigins.some((origin) => {
    try {
      const parsed = new URL(origin);
      return parsed.protocol !== 'https:' || parsed.origin !== origin;
    } catch {
      return true;
    }
  })) {
    throw new Error('CORS_ORIGIN must contain one or more HTTPS origins in production');
  }
}
