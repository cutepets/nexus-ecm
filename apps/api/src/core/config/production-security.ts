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
}
