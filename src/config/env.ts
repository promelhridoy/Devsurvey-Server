// Environment is read lazily (on every call) so tests can change it safely.

export interface Env {
  nodeEnv: string;
  isProd: boolean;
  port: number;
  mongoUri: string;
  corsOrigins: string[];
  adminUsername: string;
  adminPasswordHash: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  cookieSameSite: 'lax' | 'strict' | 'none';
  trustProxy: number;
  submitLimitMax: number;
  submitLimitWindowMin: number;
  loginLimitMax: number;
  loginLimitWindowMin: number;
}

const num = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export function getEnv(): Env {
  const e = process.env;
  const sameSite = (e.COOKIE_SAMESITE || 'lax').toLowerCase();
  return {
    nodeEnv: e.NODE_ENV || 'development',
    isProd: e.NODE_ENV === 'production',
    port: num(e.PORT, 5000),
    mongoUri: e.MONGODB_URI || '',
    corsOrigins: (e.CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim().replace(/\/$/, ''))
      .filter(Boolean),
    adminUsername: e.ADMIN_USERNAME || '',
    adminPasswordHash: e.ADMIN_PASSWORD_HASH || '',
    jwtSecret: e.JWT_SECRET || '',
    jwtExpiresIn: e.JWT_EXPIRES_IN || '8h',
    cookieSameSite: sameSite === 'strict' || sameSite === 'none' ? sameSite : 'lax',
    trustProxy: num(e.TRUST_PROXY, 0),
    submitLimitMax: num(e.SUBMIT_RATE_LIMIT_MAX, 20),
    submitLimitWindowMin: num(e.SUBMIT_RATE_LIMIT_WINDOW_MIN, 15),
    loginLimitMax: num(e.LOGIN_RATE_LIMIT_MAX, 5),
    loginLimitWindowMin: num(e.LOGIN_RATE_LIMIT_WINDOW_MIN, 15),
  };
}

/** Fail fast at startup if a required secret is missing or weak. */
export function assertEnv(): void {
  const env = getEnv();
  const problems: string[] = [];
  if (!env.mongoUri) problems.push('MONGODB_URI is required');
  if (!env.adminUsername) problems.push('ADMIN_USERNAME is required');
  if (!env.adminPasswordHash.startsWith('$2')) problems.push('ADMIN_PASSWORD_HASH must be a bcrypt hash (npm run hash-password)');
  if (env.jwtSecret.length < 32) problems.push('JWT_SECRET must be at least 32 characters');
  if (env.isProd && env.corsOrigins.length === 0) problems.push('CORS_ORIGINS is required in production');
  if (problems.length) {
    throw new Error(`Invalid environment configuration:\n - ${problems.join('\n - ')}`);
  }
}
